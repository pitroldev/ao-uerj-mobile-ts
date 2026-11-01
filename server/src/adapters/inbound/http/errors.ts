import type { NextFunction, Request, Response } from 'express';

import type { ApiError } from './contract.ts';
import {
  DomainError,
  InvalidInputError,
  UnavailableError,
} from '../../../shared/errors.ts';

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    error: 'not_found',
    message: 'Route not found',
  } satisfies ApiError);
}

type BodyParserError = Error & { status?: number; type?: string };

/** O erro em `{ error, message }`, com o status de cada tipo. */
function describe(err: unknown): { status: number; body: ApiError } {
  if (err instanceof InvalidInputError)
    return { status: 400, body: { error: err.code, message: err.message } };
  if (err instanceof UnavailableError)
    return { status: 503, body: { error: err.code, message: err.message } };
  if (err instanceof DomainError)
    return { status: 422, body: { error: err.code, message: err.message } };

  const parser = err as BodyParserError;
  if (parser.type === 'entity.parse.failed')
    return {
      status: 400,
      body: {
        error: 'invalid_json',
        message: 'Request body contains invalid JSON',
      },
    };
  if (parser.type === 'entity.too.large')
    return {
      status: 413,
      body: {
        error: 'payload_too_large',
        message: 'Request body exceeds the configured size limit',
      },
    };
  return {
    status: 500,
    body: {
      error: 'internal_server_error',
      message: 'Unexpected server error',
    },
  };
}

/** O último middleware: traduz o erro e registra os 5xx no log da requisição. */
export function handleError(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }
  const { status, body } = describe(err);
  if (status >= 500) req.log.error({ err }, 'request failed');
  res.status(status).json(body);
}
