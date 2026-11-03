import type { NextFunction, Request, Response } from 'express';

import type { ApiError } from './contract.ts';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  InvalidInputError,
  NotFoundError,
  UnavailableError,
} from '../../../shared/errors.ts';

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    error: 'not_found',
    message: 'Route not found',
  } satisfies ApiError);
}

/** O erro das bibliotecas (Express, body-parser): status e se é do cliente. */
type LibraryError = Error & {
  status?: number;
  type?: string;
  expose?: boolean;
};

/** Os 4xx que as bibliotecas dão, com um código estável e sem a mensagem delas. */
const CLIENT_ERRORS: Record<number, ApiError> = {
  400: { error: 'bad_request', message: 'The request could not be read' },
  415: {
    error: 'unsupported_media_type',
    message: 'The request body encoding or charset is not supported',
  },
};

/** O erro em `{ error, message }`, com o status de cada tipo. */
function describe(err: unknown): { status: number; body: ApiError } {
  if (err instanceof InvalidInputError)
    return { status: 400, body: { error: err.code, message: err.message } };
  if (err instanceof UnavailableError)
    return { status: 503, body: { error: err.code, message: err.message } };
  if (err instanceof NotFoundError)
    return { status: 404, body: { error: err.code, message: err.message } };
  if (err instanceof ForbiddenError)
    return { status: 403, body: { error: err.code, message: err.message } };
  if (err instanceof ConflictError)
    return { status: 409, body: { error: err.code, message: err.message } };
  if (err instanceof DomainError)
    return { status: 422, body: { error: err.code, message: err.message } };

  const parser = err as LibraryError;
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
  // outro erro do cliente que a biblioteca já marcou (um caminho com
  // codificação quebrada, um charset desconhecido): o status dela, não 500.
  // O roteador do Express marca o caminho com status 400 e sem `expose`.
  const status = parser.status;
  if (
    parser.expose !== false &&
    typeof status === 'number' &&
    status >= 400 &&
    status < 500
  )
    return { status, body: CLIENT_ERRORS[status] ?? CLIENT_ERRORS[400] };
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
