import express, { type RequestHandler, type Response } from 'express';
import { z } from 'zod';

import {
  INSTALLATION_BYTES,
  ISSUANCE_CHALLENGE_BYTES,
  TOKEN_REQUEST_BYTES,
} from '../../../../modules/access/domain.ts';
import type {
  IssuanceRefusal,
  TokenIssuer,
} from '../../../../modules/access/ports.ts';
import type {
  ApiError,
  TokenChallengeResponse,
  TokenIssuanceResponse,
} from '../contract.ts';
import { body, parse, requiredText, required } from '../validation.ts';
import { base64url, bytesField } from './base64url.ts';

/** Um token de integridade da Play tem uns poucos KB. */
const INTEGRITY_TOKEN_MAX = 16 * 1024;

const answer = (res: Response, status: number, payload: object) => {
  res.set('Cache-Control', 'no-store').status(status).json(payload);
};

/** A resposta de cada recusa: o app decide pelo `error`. */
const REFUSALS: Record<
  Exclude<IssuanceRefusal, 'unavailable'>,
  { status: number; body: ApiError }
> = {
  invalid_challenge: {
    status: 403,
    body: {
      error: 'invalid_challenge',
      message:
        'The challenge is invalid, expired or already used; get a new one',
    },
  },
  invalid_token_request: {
    status: 422,
    body: {
      error: 'invalid_token_request',
      message: 'A token request does not match the current token key',
    },
  },
  attestation_failed: {
    status: 403,
    body: {
      error: 'attestation_failed',
      message: 'The app or the device could not be verified',
    },
  },
  limit_reached: {
    status: 429,
    body: {
      error: 'issuance_limit_reached',
      message: 'This installation already received its tokens for today',
    },
  },
};

const UNAVAILABLE: ApiError = {
  error: 'token_issuance_unavailable',
  message: 'Token issuance is not available right now',
};

/**
 * A emissão dos tokens de aluno: `GET /tokens/challenge` dá o desafio de
 * uso único e a chave; `POST /tokens` troca o desafio, a atestação do app e
 * os pedidos cegos pelas assinaturas cegas. Nada aqui exige token: é assim
 * que o app consegue os primeiros.
 */
export function tokenRoutes({
  tokens,
  withDatabase,
  tokenLimit,
  batchSize,
}: {
  tokens: TokenIssuer;
  withDatabase: RequestHandler;
  tokenLimit: RequestHandler;
  batchSize: number;
}) {
  const routes = express.Router();

  const issuanceSchema = body({
    challenge: bytesField('challenge', ISSUANCE_CHALLENGE_BYTES),
    installation: bytesField('installation', INSTALLATION_BYTES),
    integrityToken: requiredText('integrityToken', {
      max: INTEGRITY_TOKEN_MAX,
    }),
    tokenRequests: z
      .array(bytesField('tokenRequests', TOKEN_REQUEST_BYTES), {
        error: required('tokenRequests', 'an array'),
      })
      .min(1, 'tokenRequests must have at least 1 request')
      .max(batchSize, `tokenRequests must have at most ${batchSize} requests`),
  });

  // não grava nada: o desafio leva o próprio HMAC
  routes.get('/tokens/challenge', tokenLimit, (req, res) => {
    const issued = tokens.challenge();
    if (!issued) {
      answer(res, 503, UNAVAILABLE);
      return;
    }
    answer(res, 200, {
      challenge: base64url(issued.challenge),
      expiresAt: issued.expiresAt.toISOString(),
      tokenKey: base64url(issued.tokenKey),
    } satisfies TokenChallengeResponse);
  });

  routes.post('/tokens', tokenLimit, withDatabase, async (req, res) => {
    const request = parse(issuanceSchema, req.body);
    const result = await tokens.issue(request);
    if (result.issued) {
      req.log.info({ tokens: result.tokenResponses.length }, 'tokens issued');
      answer(res, 200, {
        tokenKey: base64url(result.tokenKey),
        tokenResponses: result.tokenResponses.map(base64url),
      } satisfies TokenIssuanceResponse);
      return;
    }
    if (result.reason === 'unavailable') {
      answer(res, 503, UNAVAILABLE);
      return;
    }
    req.log.info(
      { reason: result.reason, detail: result.detail },
      'token issuance refused',
    );
    // a data, não os segundos: o relógio é o do caso de uso
    if (result.retryAt) res.set('Retry-After', result.retryAt.toUTCString());
    const refusal = REFUSALS[result.reason];
    answer(res, refusal.status, refusal.body);
  });

  return routes;
}
