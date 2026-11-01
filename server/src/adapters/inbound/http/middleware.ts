import { randomUUID, timingSafeEqual } from 'node:crypto';

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';

import type { ApiError } from './contract.ts';

const send = (res: Response, status: number, body: ApiError) => {
  res.status(status).json(body);
};

const REQUEST_ID = /^[\w.-]{1,64}$/;

/**
 * Uma linha de log por requisição, com o id (`X-Request-Id`, o do proxy ou
 * um novo), método, caminho sem query, status e duração. Sem IP nem
 * User-Agent.
 */
export function requestLog(logger: Logger): RequestHandler {
  return pinoHttp({
    logger,
    genReqId(req, res) {
      const incoming = req.headers['x-request-id'];
      const id =
        typeof incoming === 'string' && REQUEST_ID.test(incoming)
          ? incoming
          : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    serializers: {
      req: req => ({
        id: req.id,
        method: req.method,
        path: String(req.url).split('?')[0],
      }),
      res: res => ({ statusCode: res.statusCode }),
    },
    customLogLevel(req, res, err) {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  });
}

/** Sem o banco, as rotas que dependem dele respondem 503 na hora. */
export function requireDatabase(isReady: () => boolean): RequestHandler {
  return (req, res, next) => {
    if (isReady()) {
      next();
      return;
    }
    send(res, 503, {
      error: 'database_unavailable',
      message: 'The database is temporarily unavailable',
    });
  };
}

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Rotas de administração (as listagens com e-mail): exigem
 * `Authorization: Bearer <ADMIN_TOKEN>`. Sem o token configurado, não existem.
 */
export function adminOnly(token: string | undefined): RequestHandler {
  return (req, res, next) => {
    if (!token) {
      send(res, 404, { error: 'not_found', message: 'Route not found' });
      return;
    }
    const given = /^Bearer\s+(.+)$/i.exec(req.get('authorization') ?? '')?.[1];
    if (!given || !sameSecret(given, token)) {
      send(res, 401, {
        error: 'unauthorized',
        message: 'A valid admin token is required',
      });
      return;
    }
    next();
  };
}

/**
 * Atrás de um proxy confiável, uma requisição em HTTP volta para a mesma rota
 * na origem pública. Só o caminho e a query passam: "//outro.host/x" não
 * troca de origem.
 */
export function forceHttps(publicUrl: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.secure) {
      next();
      return;
    }
    const canonical = new URL(publicUrl);
    const requested = new URL(req.originalUrl, 'http://request.local');
    canonical.pathname = requested.pathname;
    canonical.search = requested.search;
    canonical.hash = '';
    res.redirect(308, canonical.toString());
  };
}

/**
 * Limite por IP (atrás do proxy, com `TRUST_PROXY`), por minuto, com a conta
 * própria de cada rota que o usa. Folgado: os alunos de um campus saem pelo
 * mesmo IP.
 */
export function perMinuteLimit(perMinute: number): RequestHandler {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: perMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler(req, res) {
      send(res, 429, {
        error: 'rate_limited',
        message: 'Too many requests; try again in a minute',
      });
    },
  });
}
