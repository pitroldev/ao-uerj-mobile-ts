import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';

import type { AdminSession } from './adminSession.ts';
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

/**
 * Rotas de administração (as listagens com e-mail): exigem
 * `Authorization: Bearer <ADMIN_TOKEN>` ou o cookie do login de
 * `/aouerj/admin`. Sem o acesso (ou sem o token configurado), respondem como
 * uma rota que não existe: nada indica que há algo ali para tentar abrir.
 */
export function adminOnly(session: AdminSession | null): RequestHandler {
  return (req, res, next) => {
    if (!session?.allows(req)) {
      send(res, 404, { error: 'not_found', message: 'Route not found' });
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

/**
 * Limite por minuto contado pela chave que `keyOf` tira da requisição (a
 * chave de membro da Companhia agora), e não pelo IP: o Wi-Fi do campus põe
 * todo mundo atrás do mesmo. Sem a chave, a requisição passa por aqui sem
 * contar (o teto por IP cuida dela).
 */
export function perKeyLimit(
  perMinute: number,
  keyOf: (req: Request) => string | undefined,
): RequestHandler {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: perMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: req => !keyOf(req),
    keyGenerator: req => `key:${keyOf(req)}`,
    handler(req, res) {
      send(res, 429, {
        error: 'rate_limited',
        message: 'Too many requests; try again in a minute',
      });
    },
  });
}
