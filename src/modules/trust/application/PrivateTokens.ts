import { equalBytes, fromBase64, toBase64, toHex } from '../domain/bytes';
import {
  authorization,
  blindToken,
  encodeChallenge,
  finalizeToken,
  issuanceRequestHash,
  parseTokenKey,
} from '../domain/privateToken';
import {
  addTokens,
  BATCH_SIZE,
  EMPTY_STOCK,
  keepKeys,
  needsRefill,
  nextUtcDay,
  RETRY_REFUSED_MS,
  RETRY_TRANSIENT_MS,
  takeToken,
  type TokenStock,
} from '../domain/tokenStock';
import type { DeviceTrustPort, TokenIssuerPort, TokenStorePort } from './ports';

type Dependencies = {
  issuer: TokenIssuerPort;
  /** `null` onde não há atestação (iOS, módulo ausente): o app não pede tokens. */
  device: DeviceTrustPort | null;
  /** `null` sem o cofre: sem onde guardar, o app não pede tokens. */
  store: TokenStorePort | null;
  /**
   * Os ids (hex) das chaves do emissor publicadas no aviso remoto, o mesmo
   * arquivo para todos; `null` antes de lê-lo. O app recusa outra chave, o
   * que impede o servidor de marcar um aluno com uma chave só dele.
   */
  allowedKeys: () => readonly string[] | null;
  now: () => number;
};

export type RefillResult =
  'unsupported' | 'no-keys' | 'enough' | 'waiting' | 'refilled' | 'failed';

type Batch = { tokens: string[] } | { again: true } | { retryAt: number };

const INSTALLATION_BYTES = 32;

/**
 * Os tokens anônimos de aluno: o app logado pede um lote ao emissor, com a
 * atestação da Play, e guarda os tokens prontos; cada requisição de aluno
 * gasta um. Quem decide quando repor (sessão confirmada no portal, segundo
 * plano) é a composição.
 */
export class PrivateTokens {
  private queue: Promise<unknown> = Promise.resolve();
  private refilling: Promise<RefillResult> | null = null;

  constructor(private readonly dependencies: Dependencies) {}

  /** Pede um lote se o estoque estiver baixo. Um por vez; não rejeita. */
  refill(): Promise<RefillResult> {
    this.refilling ??= this.runRefill()
      .catch((): RefillResult => 'failed')
      .finally(() => {
        this.refilling = null;
      });
    return this.refilling;
  }

  /**
   * O cabeçalho `Authorization` com o próximo token, que sai do estoque antes
   * do uso (um token não vale duas vezes); `null` sem token.
   */
  take(): Promise<string | null> {
    return this.change(stock => {
      const next = takeToken(stock);
      const bytes = next && fromBase64(next.token);
      return next && bytes ? [next.stock, authorization(bytes)] : [stock, null];
    });
  }

  /** O logout apaga o estoque (o id da instalação fica). */
  clear(): Promise<void> {
    return this.change(() => [EMPTY_STOCK, undefined]);
  }

  /** Quantos tokens há (as chaves que saíram de uso já descontadas). */
  count(): Promise<number> {
    return this.change(stock => [stock, stock.tokens.length]);
  }

  /** Lê, muda e grava o estoque, uma mudança por vez. */
  private change<T>(
    update: (stock: TokenStock) => [TokenStock, T],
  ): Promise<T> {
    const { store, allowedKeys } = this.dependencies;
    const task = this.queue.then(async () => {
      const saved = (await store?.readStock()) ?? EMPTY_STOCK;
      const allowed = allowedKeys();
      const current = allowed ? keepKeys(saved, allowed) : saved;
      const [next, result] = update(current);
      if (store && next !== saved) await store.writeStock(next);
      return result;
    });
    this.queue = task.catch(() => undefined);
    return task;
  }

  private async runRefill(): Promise<RefillResult> {
    const { device, store, allowedKeys, now } = this.dependencies;
    if (!device || !store) return 'unsupported';
    const allowed = allowedKeys();
    if (!allowed?.length) return 'no-keys';
    const stock = await this.change(current => [current, current]);
    if (!needsRefill(stock)) return 'enough';
    if (stock.retryAt !== null && now() < stock.retryAt) return 'waiting';

    let batch = await this.requestBatch(device, store, allowed);
    // desafio vencido ou chave trocada no meio: um desafio novo, uma vez
    if ('again' in batch)
      batch = await this.requestBatch(device, store, allowed);
    if ('tokens' in batch) {
      const { tokens } = batch;
      await this.change(current => [addTokens(current, tokens), undefined]);
      return 'refilled';
    }
    const retryAt =
      'retryAt' in batch ? batch.retryAt : now() + RETRY_TRANSIENT_MS;
    await this.change(current => [{ ...current, retryAt }, undefined]);
    return 'failed';
  }

  /** Um lote: desafio, pedidos cegos, atestação, assinaturas e os tokens prontos. */
  private async requestBatch(
    device: DeviceTrustPort,
    store: TokenStorePort,
    allowed: readonly string[],
  ): Promise<Batch> {
    const { issuer, now } = this.dependencies;
    const { crypto } = device;
    const transient = () => ({ retryAt: now() + RETRY_TRANSIENT_MS });
    const challenge = await issuer.challenge();
    if (!challenge) return transient();
    const key = parseTokenKey(crypto, challenge.tokenKey);
    // uma chave fora do aviso remoto não é usada (a publicação pode atrasar)
    if (!key || !allowed.includes(toHex(key.id))) return transient();

    const installation = await this.installation(store, device);
    const tokenChallenge = encodeChallenge();
    const blinded = Array.from({ length: BATCH_SIZE }, () =>
      blindToken(crypto, key, tokenChallenge),
    );
    const tokenRequests = blinded.map(token => token.request);
    const attestation = await device.attest(
      issuanceRequestHash(crypto, {
        challenge: challenge.challenge,
        installation,
        tokenRequests,
      }),
    );
    if ('failure' in attestation)
      return attestation.failure === 'transient'
        ? transient()
        : { retryAt: now() + RETRY_REFUSED_MS };

    const issuance = await issuer.issue({
      challenge: challenge.challenge,
      installation,
      integrityToken: attestation.token,
      tokenRequests,
    });
    if (!issuance.issued)
      switch (issuance.refusal) {
        case 'invalid_challenge':
        case 'invalid_token_request':
          return { again: true };
        case 'limit_reached':
          return { retryAt: issuance.retryAt ?? nextUtcDay(now()) };
        case 'attestation_failed':
          return { retryAt: now() + RETRY_REFUSED_MS };
        default:
          return transient();
      }

    if (
      !equalBytes(issuance.tokenKey, challenge.tokenKey) ||
      issuance.tokenResponses.length !== blinded.length
    )
      return transient();
    const tokens: string[] = [];
    for (const [index, token] of blinded.entries()) {
      const finished = finalizeToken(
        crypto,
        key,
        token,
        issuance.tokenResponses[index],
      );
      // uma assinatura que não confere invalida o lote inteiro
      if (!finished) return transient();
      tokens.push(toBase64(finished, { url: true }));
    }
    return { tokens };
  }

  /** O id da instalação, criado na primeira emissão. */
  private async installation(
    store: TokenStorePort,
    device: DeviceTrustPort,
  ): Promise<Uint8Array> {
    const saved = await store.readInstallation();
    const bytes = saved ? fromBase64(saved) : null;
    if (bytes?.length === INSTALLATION_BYTES) return bytes;
    const created = device.crypto.randomBytes(INSTALLATION_BYTES);
    await store.writeInstallation(toBase64(created, { url: true }));
    return created;
  }
}
