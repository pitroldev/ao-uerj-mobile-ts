import { systemClock, type Clock } from '../../shared/clock.ts';
import { InvalidInputError } from '../../shared/errors.ts';
import {
  blindSign,
  challengeDigest,
  encodeChallenge,
  INSTALLATION_BYTES,
  installationDayId,
  isSigningKey,
  issuanceChallenge,
  issuanceRequestHash,
  issuanceSecrets,
  openIssuanceChallenge,
  parseToken,
  parseTokenRequest,
  requestFitsKey,
  spentId,
  tokenFromAuthorization,
  usedChallengeId,
  verifyToken,
  type IssuanceSecrets,
  type IssuerKey,
  type SigningKey,
  type TokenRequest,
} from './domain.ts';
import type {
  AppAttester,
  Issuance,
  IssuanceCounter,
  SingleUse,
  StudentAccess,
  TokenIssuer,
} from './ports.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Quanto um token gasto fica guardado depois de a chave vencer. O MongoDB
 * apaga pelo relógio dele: adiantado em relação ao nosso, apagaria o gasto
 * enquanto a chave ainda vale aqui, e o token valeria de novo.
 */
const SPENT_GRACE_MS = DAY_MS;

/** A que vale por mais tempo, entre as que valem agora. */
function newest<Key extends IssuerKey>(
  keys: readonly Key[],
  now: number,
): Key | undefined {
  return keys
    .filter(key => key.notAfter.getTime() > now)
    .sort((a, b) => b.notAfter.getTime() - a.notAfter.getTime())[0];
}

/**
 * Quanto vale um passe de aluno: as leituras de uma hora de uso (a lista da
 * Companhia agora), sem gastar um token a cada atualização.
 */
export const STUDENT_PASS_TTL_MS = 60 * 60 * 1000;

/** O passe em base64url: 36 bytes, 48 caracteres. */
const STUDENT_PASS = /^[A-Za-z0-9_-]{48}$/;

/**
 * O resgate dos tokens de aluno. O desafio é fixo (emissor e origem, sem
 * `redemption_context`), para o app buscar os tokens com antecedência e em
 * lote, longe da hora do uso.
 */
export function createStudentAccess({
  keys,
  spentTokens,
  issuer,
  origin,
  now = systemClock,
}: {
  keys: readonly IssuerKey[];
  spentTokens: SingleUse;
  issuer: string;
  origin: string;
  now?: Clock;
}): StudentAccess {
  const challenge = encodeChallenge({
    issuer,
    redemptionContext: Buffer.alloc(0),
    origins: [origin],
  });
  const digest = challengeDigest(challenge);
  // o passe se autentica com um segredo tirado de cada chave privada
  const signing = keys.filter(isSigningKey);
  const passSecrets = new Map<SigningKey, Buffer>();
  const passSecretOf = (key: SigningKey) => {
    let found = passSecrets.get(key);
    if (!found) {
      found = issuanceSecrets(key).pass;
      passSecrets.set(key, found);
    }
    return found;
  };

  return {
    issuePass() {
      const key = newest(signing, now());
      if (!key) return null;
      const { challenge: pass, expiresAt } = issuanceChallenge(
        passSecretOf(key),
        new Date(now() + STUDENT_PASS_TTL_MS),
      );
      return { pass, expiresAt };
    },

    checkPass(pass) {
      if (!pass || !STUDENT_PASS.test(pass)) return false;
      const bytes = Buffer.from(pass, 'base64url');
      const at = now();
      // vale o de qualquer chave que ainda vale: a troca de chave não
      // derruba os passes da hora
      return signing.some(
        key =>
          key.notAfter.getTime() > at &&
          openIssuanceChallenge(passSecretOf(key), bytes, new Date(at)) !==
            null,
      );
    },

    challenge() {
      // a que vale por mais tempo é a que o app deve buscar
      const current = newest(keys, now());
      return current ? { challenge, tokenKey: current.spki } : null;
    },

    async redeem(authorization) {
      if (!newest(keys, now()))
        return { authenticated: false, reason: 'unavailable' };
      if (!authorization || !/^PrivateToken\s/i.test(authorization.trim()))
        return { authenticated: false, reason: 'missing' };
      const bytes = tokenFromAuthorization(authorization);
      const token = bytes && parseToken(bytes);
      if (!token) return { authenticated: false, reason: 'malformed' };
      const verdict = verifyToken(token, {
        digest,
        keys,
        now: new Date(now()),
      });
      if ('rejected' in verdict)
        return { authenticated: false, reason: verdict.rejected };
      // gasto duplo: o segundo uso perde na gravação, sem corrida
      const fresh = await spentTokens.spend(
        spentId(token),
        new Date(verdict.key.notAfter.getTime() + SPENT_GRACE_MS),
      );
      return fresh
        ? { authenticated: true }
        : { authenticated: false, reason: 'spent' };
    },
  };
}

/** Quanto o app tem para pedir o lote depois de receber o desafio. */
export const ISSUANCE_CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * A emissão dos tokens de aluno (a fase 1 do plano): um lote só sai para o
 * app genuíno, num aparelho íntegro (a atestação), com um desafio nosso e
 * dentro do limite diário da instalação. O app só pede logado no Aluno
 * Online; o servidor não vê o login, e é isso que a fase 2 mudaria.
 *
 * Assina com a chave privada que vale por mais tempo. A assinatura é cega:
 * o servidor não vê os tokens, e o resgate não se liga à emissão.
 */
export function createTokenIssuer({
  keys,
  attester,
  usedChallenges,
  counter,
  batchSize,
  batchesPerDay,
  now = systemClock,
}: {
  keys: readonly IssuerKey[];
  /** `null`: sem quem ateste, não há emissão. */
  attester: AppAttester | null;
  usedChallenges: SingleUse;
  counter: IssuanceCounter;
  /** Quantos tokens cabem num lote. */
  batchSize: number;
  /** Quantos lotes uma instalação recebe por dia (UTC). */
  batchesPerDay: number;
  now?: Clock;
}): TokenIssuer {
  const signing = keys.filter(isSigningKey);
  const secrets = new Map<SigningKey, IssuanceSecrets>();
  const secretsOf = (key: SigningKey) => {
    let found = secrets.get(key);
    if (!found) {
      found = issuanceSecrets(key);
      secrets.set(key, found);
    }
    return found;
  };
  const current = () => (attester ? newest(signing, now()) : undefined);

  return {
    challenge() {
      const key = current();
      if (!key) return null;
      const { challenge, expiresAt } = issuanceChallenge(
        secretsOf(key).challenge,
        new Date(now() + ISSUANCE_CHALLENGE_TTL_MS),
      );
      return { challenge, expiresAt, tokenKey: key.spki };
    },

    async issue({
      challenge,
      installation,
      integrityToken,
      tokenRequests,
    }): Promise<Issuance> {
      if (
        installation.length !== INSTALLATION_BYTES ||
        tokenRequests.length < 1 ||
        tokenRequests.length > batchSize
      )
        throw new InvalidInputError(
          `a batch has 1 to ${batchSize} token requests and a ${INSTALLATION_BYTES}-byte installation`,
        );
      const key = current();
      if (!key || !attester) return { issued: false, reason: 'unavailable' };
      const secret = secretsOf(key);
      const at = now();
      const expiresAt = openIssuanceChallenge(
        secret.challenge,
        challenge,
        new Date(at),
      );
      if (!expiresAt) return { issued: false, reason: 'invalid_challenge' };

      const requests: TokenRequest[] = [];
      for (const bytes of tokenRequests) {
        const request = parseTokenRequest(bytes);
        if (!request || !requestFitsKey(key, request))
          return { issued: false, reason: 'invalid_token_request' };
        requests.push(request);
      }

      // o desafio vale uma vez, e é gasto antes de perguntar à atestação
      if (!(await usedChallenges.spend(usedChallengeId(challenge), expiresAt)))
        return { issued: false, reason: 'invalid_challenge' };

      const attestation = await attester.verify(
        integrityToken,
        issuanceRequestHash({ challenge, installation, tokenRequests }),
      );
      if (!attestation.trusted)
        return {
          issued: false,
          reason: 'attestation_failed',
          detail: attestation.reason,
        };

      const day = new Date(at).toISOString().slice(0, 10);
      const tomorrow = Date.parse(`${day}T00:00:00Z`) + DAY_MS;
      const counted = await counter.count(
        installationDayId(secret.installation, installation, day),
        batchesPerDay,
        // um dia de folga, pelo mesmo motivo dos tokens gastos
        new Date(tomorrow + DAY_MS),
      );
      if (!counted)
        return {
          issued: false,
          reason: 'limit_reached',
          retryAt: new Date(tomorrow),
        };

      return {
        issued: true,
        tokenKey: key.spki,
        tokenResponses: requests.map(request => blindSign(key, request)),
      };
    },
  };
}
