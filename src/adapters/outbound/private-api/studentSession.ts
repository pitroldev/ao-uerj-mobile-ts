import axios from 'axios';
import { AppError } from '@root/shared/errors/AppError';
import { fromBase64, toBase64 } from '@root/modules/trust/domain/bytes';
import type { StudentBan } from '@root/modules/trust/domain/studentSession';
import type {
  DeviceProof,
  SessionCreation,
  StudentSessionApiPort,
} from '@root/modules/trust/application/ports';
// O contrato do servidor (server/); só tipos, apagados no bundle.
import type {
  StudentBannedError,
  StudentChallengeResponse,
  StudentSessionRequest,
  StudentSessionResponse,
} from '../../../../server/src/adapters/inbound/http/contract';
import type { PrivateApiHttpClient } from './index';

const encode = (value: Uint8Array) => toBase64(value, { url: true });

/**
 * A prova do aparelho no campo do contrato: vai uma só, o token da Play
 * (Android) ou o App Attest (iPhone).
 */
function proofFields(
  proof: DeviceProof,
): Pick<StudentSessionRequest, 'integrityToken' | 'appAttest'> {
  if ('token' in proof) return { integrityToken: proof.token };
  const { keyId, attestation } = proof.appAttest;
  return { appAttest: { keyId, attestation } };
}

/** A falha que não é uma recusa do servidor: rede ou resposta inesperada. */
function failure(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (axios.isAxiosError(error) && !error.response)
    return new AppError('NETWORK');
  if (axios.isAxiosError(error) && error.response?.status === 429)
    return new AppError('RATE_LIMITED');
  return new AppError('SERVICE_UNAVAILABLE');
}

/** O 403 `student_banned`, como o app guarda; `null` se não for ele. */
export function banOf(data: unknown): StudentBan | null {
  const body = data as Partial<StudentBannedError> | null | undefined;
  if (body?.error !== 'student_banned') return null;
  const until =
    typeof body.until === 'string' && !Number.isNaN(Date.parse(body.until))
      ? Date.parse(body.until)
      : null;
  return {
    until,
    reason: typeof body.reason === 'string' ? body.reason : '',
  };
}

/** As recusas que o servidor documenta em contract.ts. */
function refusal(error: unknown): SessionCreation | null {
  if (!axios.isAxiosError(error) || !error.response) return null;
  const { status, data } = error.response;
  const code = (data as { error?: unknown } | undefined)?.error;
  const ban = banOf(data);
  if (ban) return { created: false, refusal: 'banned', ban };
  if (status === 403 && code === 'invalid_challenge')
    return { created: false, refusal: 'invalid_challenge' };
  if (status === 403 && code === 'attestation_failed')
    return { created: false, refusal: 'attestation_failed' };
  // 400 é um pedido malformado e 503, a identificação desligada: insistir não ajuda
  if (status === 400 || status === 503)
    return { created: false, refusal: 'unavailable' };
  return null;
}

/**
 * A identificação do aluno (`/aouerj/v2/students`): o desafio, a entrada e a
 * saída. Os bytes vão em base64url com o `=` do fim; os do App Attest, em
 * base64 padrão, como a Apple os dá.
 */
export function createStudentSessionApi(
  client: PrivateApiHttpClient,
): StudentSessionApiPort {
  return {
    async challenge() {
      try {
        const { data } = await client.get('/v2/students/challenge');
        const body = data as Partial<StudentChallengeResponse> | null;
        const challenge =
          typeof body?.challenge === 'string'
            ? fromBase64(body.challenge)
            : null;
        if (!challenge) throw new AppError('SERVICE_UNAVAILABLE');
        return challenge;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 503)
          return null;
        throw failure(error);
      }
    },
    async create(request) {
      try {
        const { data } = await client.post('/v2/students/session', {
          challenge: encode(request.challenge),
          installation: encode(request.installation),
          ...proofFields(request.proof),
          matricula: request.matricula,
          name: request.name,
        } satisfies StudentSessionRequest);
        const body = data as Partial<StudentSessionResponse> | null;
        const expiresAt = Date.parse(String(body?.expiresAt));
        if (typeof body?.session !== 'string' || Number.isNaN(expiresAt))
          throw new AppError('SERVICE_UNAVAILABLE');
        return { created: true, token: body.session, expiresAt };
      } catch (error) {
        const refused = refusal(error);
        if (refused) return refused;
        throw failure(error);
      }
    },
    async end(token) {
      await client
        .post(
          '/v2/students/session/end',
          {},
          {
            headers: { Authorization: `Student ${token}` },
          },
        )
        .catch(() => undefined);
    },
  };
}
