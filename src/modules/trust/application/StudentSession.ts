import { AppError } from '@root/shared/errors/AppError';
import { fromBase64, toBase64 } from '../domain/bytes';
import {
  banMessage,
  INSTALLATION_BYTES,
  normalizeName,
  sessionRequestHash,
  type StudentBan,
} from '../domain/studentSession';
import type {
  DeviceTrustPort,
  SessionCreation,
  StudentSessionApiPort,
  StudentSessionStorePort,
} from './ports';

/** A conta do login no Aluno Online: de onde vêm a matrícula e o nome. */
type Account = { scope: string; matricula: string; name: string };

type Dependencies = {
  api: StudentSessionApiPort;
  /**
   * `null` onde não há atestação (simulador, módulo ausente): o app não
   * entra. A Play Integrity no Android e o App Attest no iPhone.
   */
  device: DeviceTrustPort | null;
  /** `null` sem o cofre: sem onde guardar a sessão, o app não entra. */
  store: StudentSessionStorePort | null;
  /** A conta logada agora; `null` fora dela. */
  account: () => Account | null | undefined;
  now?: () => number;
};

const MINUTE = 60_000;

/**
 * Quanto esperar para entrar de novo depois de cada recusa. Cada tentativa
 * gasta uma atestação (da Play ou da Apple) e uma verificação na cota do
 * servidor: as telas que perguntam de tempos em tempos não podem repetir a
 * entrada toda vez.
 */
export const RETRY_AFTER_MS = {
  /**
   * O app, a loja ou o aparelho não passaram, ou a Play (o App Attest) não
   * existe aqui.
   */
  refused: 60 * MINUTE,
  /** O servidor sem a identificação ou recusando o pedido. */
  server: 10 * MINUTE,
  /** Play ou Apple ocupada, limite do servidor, desafio vencido duas vezes. */
  transient: MINUTE,
  /** Banido: confere de novo de hora em hora (a moderação pode desbanir). */
  banned: 60 * MINUTE,
} as const;

/** A última recusa, por conta: até quando o app nem tenta. */
type Refusal = { scope: string; until: number; error: AppError };

/**
 * A sessão de aluno no servidor. Na primeira vez (e quando o servidor a
 * recusa), o app pede um desafio, a Play Integrity (no iPhone, o App Attest)
 * atesta a matrícula e o nome do login, e o servidor devolve a sessão,
 * guardada no cofre. Daí em diante, cada pedido de aluno leva
 * `Authorization: Student <sessão>`. O logout encerra a sessão no servidor e
 * a apaga.
 */
export class StudentSession {
  private entering: { scope: string; promise: Promise<string> } | null = null;
  private refusal: Refusal | null = null;

  constructor(private readonly dependencies: Dependencies) {}

  /** O aparelho consegue entrar: tem quem ateste e onde guardar a sessão. */
  get supported(): boolean {
    return Boolean(this.dependencies.device && this.dependencies.store);
  }

  /**
   * O token da sessão da conta logada, entrando se preciso (uma entrada por
   * vez, por conta). Rejeita com `STUDENT_PROOF_UNAVAILABLE`, `NOT_LOGGED_IN`,
   * `STUDENT_BANNED` ou o erro da rede; depois de uma recusa, com o mesmo
   * erro até a hora de tentar de novo (`RETRY_AFTER_MS`).
   */
  async token(): Promise<string> {
    const { device, store, account } = this.dependencies;
    if (!device || !store) throw new AppError('STUDENT_PROOF_UNAVAILABLE');
    const owner = account();
    const saved = await store.read().catch(() => null);
    // no logout, a conta já saiu, mas a saída das mesas e dos grupos ainda
    // usa a sessão dela, até o `clear`
    if (!owner) {
      if (saved) return saved.token;
      throw new AppError('NOT_LOGGED_IN');
    }
    if (saved && saved.scope === owner.scope) return saved.token;
    const refused = this.refusal;
    if (refused?.scope === owner.scope && this.now() < refused.until)
      throw refused.error;
    if (this.entering?.scope !== owner.scope) {
      const entering = {
        scope: owner.scope,
        promise: this.enter(owner, device, store).finally(() => {
          if (this.entering === entering) this.entering = null;
        }),
      };
      this.entering = entering;
    }
    return this.entering.promise;
  }

  /** O token guardado agora, sem entrar: o logout o guarda antes de sair das mesas. */
  async current(): Promise<string | null> {
    const saved = await this.dependencies.store?.read().catch(() => null);
    return saved?.token ?? null;
  }

  /** O servidor recusou esta sessão (vencida, encerrada): a próxima entra de novo. */
  async invalidate(token: string): Promise<void> {
    const { store } = this.dependencies;
    if (!store) return;
    const saved = await store.read().catch(() => null);
    if (saved?.token === token) await store.clear().catch(() => undefined);
  }

  /** O servidor disse que o aluno está banido: o erro diz até quando e por quê. */
  banned(ban: StudentBan): AppError {
    return new AppError('STUDENT_BANNED', banMessage(ban));
  }

  /**
   * O logout: encerra no servidor a sessão `token` (a que valia quando a
   * conta saiu; sem esperar dar certo) e a apaga, se ainda for a guardada.
   * Uma conta que entrou logo depois fica com a dela.
   */
  async clear(token: string | null): Promise<void> {
    const { store, api } = this.dependencies;
    this.refusal = null;
    if (!token) return;
    const saved = store ? await store.read().catch(() => null) : null;
    if (saved?.token === token) await store?.clear().catch(() => undefined);
    await api.end(token).catch(() => undefined);
  }

  private now() {
    return (this.dependencies.now ?? Date.now)();
  }

  /** Guarda a recusa (até quando não tentar) e a devolve, para lançar. */
  private refuse(scope: string, error: AppError, waitMs: number): AppError {
    this.refusal = { scope, until: this.now() + waitMs, error };
    return error;
  }

  private async enter(
    owner: Account,
    device: DeviceTrustPort,
    store: StudentSessionStorePort,
  ): Promise<string> {
    const { api } = this.dependencies;
    const { scope } = owner;
    const matricula = owner.matricula.trim();
    const name = normalizeName(owner.name);
    const unavailable = () => new AppError('STUDENT_PROOF_UNAVAILABLE');
    // um desafio vencido entre o pedido e a entrada vale uma segunda tentativa
    for (let attempt = 1; attempt <= 2; attempt++) {
      let challenge: Uint8Array | null;
      try {
        challenge = await api.challenge();
      } catch (error) {
        throw this.failed(scope, error);
      }
      if (!challenge)
        throw this.refuse(scope, unavailable(), RETRY_AFTER_MS.server);
      const installation = await this.installation(device, store);
      const attestation = await device.attest(
        sessionRequestHash(device.crypto, {
          challenge,
          installation,
          matricula,
          name,
        }),
      );
      if ('failure' in attestation)
        throw this.refuse(
          scope,
          unavailable(),
          attestation.failure === 'transient'
            ? RETRY_AFTER_MS.transient
            : RETRY_AFTER_MS.refused,
        );
      let result: SessionCreation;
      try {
        result = await api.create({
          challenge,
          installation,
          proof: attestation,
          matricula,
          name,
        });
      } catch (error) {
        throw this.failed(scope, error);
      }
      if (result.created) {
        // a conta pode ter saído ou trocado durante a entrada: a sessão não
        // fica, e o servidor a esquece
        if (this.dependencies.account()?.scope !== scope) {
          void api.end(result.token).catch(() => undefined);
          throw new AppError('SESSION_CHANGED');
        }
        await store.write({
          token: result.token,
          scope,
          expiresAt: result.expiresAt,
        });
        if (this.refusal?.scope === scope) this.refusal = null;
        return result.token;
      }
      if (result.refusal === 'banned' && result.ban) {
        const until = result.ban.until ?? Number.POSITIVE_INFINITY;
        throw this.refuse(
          scope,
          this.banned(result.ban),
          Math.max(0, Math.min(until - this.now(), RETRY_AFTER_MS.banned)),
        );
      }
      if (result.refusal === 'attestation_failed')
        throw this.refuse(scope, unavailable(), RETRY_AFTER_MS.refused);
      if (result.refusal === 'unavailable')
        throw this.refuse(scope, unavailable(), RETRY_AFTER_MS.server);
    }
    // o desafio venceu duas vezes seguidas
    throw this.refuse(scope, unavailable(), RETRY_AFTER_MS.transient);
  }

  /**
   * A falha da rede ou do servidor no meio da entrada. Sem rede, o app tenta
   * de novo no próximo pedido (nada foi gasto); limite e erro do servidor
   * esperam um pouco.
   */
  private failed(scope: string, error: unknown): AppError {
    const known =
      error instanceof AppError ? error : new AppError('SERVICE_UNAVAILABLE');
    if (known.code === 'NETWORK' || known.code === 'CANCELLED') return known;
    return this.refuse(scope, known, RETRY_AFTER_MS.transient);
  }

  /** O id da instalação, criado na primeira entrada e o mesmo depois. */
  private async installation(
    device: DeviceTrustPort,
    store: StudentSessionStorePort,
  ): Promise<Uint8Array> {
    const saved = await store.readInstallation().catch(() => null);
    const decoded = saved ? fromBase64(saved) : null;
    if (decoded && decoded.length === INSTALLATION_BYTES) return decoded;
    const fresh = device.crypto.randomBytes(INSTALLATION_BYTES);
    await store.writeInstallation(toBase64(fresh, { url: true }));
    return fresh;
  }
}
