import axios from 'axios';
import { AppError } from '@root/shared/errors/AppError';
import { fromBase64, toBase64 } from '@root/modules/trust/domain/bytes';
import type {
  Issuance,
  IssuanceRefusal,
  TokenIssuerPort,
} from '@root/modules/trust/application/ports';
// O contrato do servidor (server/); só tipos, apagados no bundle.
import type {
  TokenChallengeResponse,
  TokenIssuanceRequest,
  TokenIssuanceResponse,
} from '../../../../server/src/adapters/inbound/http/contract';
import type { PrivateApiHttpClient } from './index';

function bytes(value: unknown): Uint8Array {
  const decoded = typeof value === 'string' ? fromBase64(value) : null;
  if (!decoded) throw new AppError('SERVICE_UNAVAILABLE');
  return decoded;
}

const encode = (value: Uint8Array) => toBase64(value, { url: true });

/** `Retry-After` em segundos ou como data HTTP. */
function retryAt(header: unknown, now: number): number | undefined {
  if (typeof header !== 'string' || !header.trim()) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return now + seconds * 1000;
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : date;
}

/** A falha que não é uma recusa do emissor: rede ou resposta inesperada. */
function failure(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (axios.isAxiosError(error) && !error.response)
    return new AppError('NETWORK');
  return new AppError('SERVICE_UNAVAILABLE');
}

/** As recusas que o servidor documenta em contract.ts. */
function refusal(error: unknown, now: number): Issuance | null {
  if (!axios.isAxiosError(error) || !error.response) return null;
  const { status, data, headers } = error.response;
  const code = (data as { error?: unknown } | undefined)?.error;
  const refused = (reason: IssuanceRefusal, at?: number): Issuance => ({
    issued: false,
    refusal: reason,
    ...(at === undefined ? {} : { retryAt: at }),
  });
  if (status === 403 && code === 'invalid_challenge')
    return refused('invalid_challenge');
  if (status === 403 && code === 'attestation_failed')
    return refused('attestation_failed');
  if (status === 422) return refused('invalid_token_request');
  // o limite do dia e o por minuto dizem quando voltar
  if (status === 429)
    return refused('limit_reached', retryAt(headers['retry-after'], now));
  // 400 é um pedido malformado: insistir não ajuda
  if (status === 400 || status === 503) return refused('unavailable');
  return null;
}

/**
 * A emissão de tokens anônimos (`/aouerj/v2/tokens`): o desafio e o lote. Os
 * bytes vão em base64url com o `=` do fim.
 */
export function createTokenIssuer(
  client: PrivateApiHttpClient,
  now: () => number = () => Date.now(),
): TokenIssuerPort {
  return {
    async challenge() {
      try {
        const { data } = await client.get('/v2/tokens/challenge');
        const body = data as Partial<TokenChallengeResponse> | null;
        return {
          challenge: bytes(body?.challenge),
          tokenKey: bytes(body?.tokenKey),
        };
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 503)
          return null;
        throw failure(error);
      }
    },
    async issue(request) {
      try {
        const { data } = await client.post('/v2/tokens', {
          challenge: encode(request.challenge),
          installation: encode(request.installation),
          integrityToken: request.integrityToken,
          tokenRequests: request.tokenRequests.map(encode),
        } satisfies TokenIssuanceRequest);
        const body = data as Partial<TokenIssuanceResponse> | null;
        if (!Array.isArray(body?.tokenResponses))
          throw new AppError('SERVICE_UNAVAILABLE');
        return {
          issued: true,
          tokenKey: bytes(body.tokenKey),
          tokenResponses: body.tokenResponses.map(bytes),
        };
      } catch (error) {
        const refused = refusal(error, now());
        if (refused) return refused;
        throw failure(error);
      }
    },
  };
}
