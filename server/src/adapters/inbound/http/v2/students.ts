import express, {
  type Request,
  type RequestHandler,
  type Response,
} from 'express';

import { ISSUANCE_CHALLENGE_BYTES } from '../../../../modules/access/domain.ts';
import {
  STUDENT_INSTALLATION_BYTES,
  STUDENT_LIMITS,
  type Ban,
} from '../../../../modules/students/domain.ts';
import type {
  EnrollmentRefusal,
  StudentActor,
  StudentIdentity,
} from '../../../../modules/students/ports.ts';
import type {
  ApiError,
  OkResponse,
  StudentBannedError,
  StudentChallengeResponse,
  StudentSessionResponse,
} from '../contract.ts';
import { body, parse, requiredText } from '../validation.ts';
import { base64url, bytesField } from './base64url.ts';

/** Um token de integridade da Play tem uns poucos KB. */
const INTEGRITY_TOKEN_MAX = 16 * 1024;

/** `Authorization: Student <32 bytes em base64url>`. */
const STUDENT_AUTHORIZATION = /^Student\s+([A-Za-z0-9_-]{43})=?\s*$/i;

const noStore = (res: Response) => res.set('Cache-Control', 'no-store');

const answer = (res: Response, status: number, payload: object) => {
  noStore(res).status(status).json(payload);
};

/** O token da sessão do `Authorization`; `undefined` sem o esquema `Student`. */
function sessionTokenOf(req: Request): Buffer | undefined {
  const match = STUDENT_AUTHORIZATION.exec(req.get('authorization') ?? '');
  const token = match?.[1];
  return token ? Buffer.from(token, 'base64url') : undefined;
}

/** Quem a sessão identificou neste pedido (o `identifyStudent`). */
export const actorOf = (res: Response): StudentActor | null =>
  (res.locals.student as StudentActor | undefined) ?? null;

export function banned(ban: Ban): StudentBannedError {
  return {
    error: 'student_banned',
    message: 'This student is banned',
    until: ban.until ? ban.until.toISOString() : null,
    reason: ban.reason,
  };
}

const INVALID_SESSION: ApiError = {
  error: 'invalid_session',
  message: 'The student session is invalid or expired; sign in again',
};

const SESSION_REQUIRED: ApiError = {
  error: 'session_required',
  message: 'A student session is required (Authorization: Student …)',
};

const UNAVAILABLE: ApiError = {
  error: 'student_identity_unavailable',
  message: 'Student sign-in is not available right now',
};

/**
 * Lê a sessão, se o pedido trouxer uma (`Authorization: Student …`): válida,
 * guarda o aluno em `res.locals.student`; vencida, 401; banido, 403 com o
 * prazo. Sem sessão, segue: quem exige é o `requireStudentSession`.
 *
 * `limit` vem antes do banco, só para quem manda uma sessão (um token
 * inventado não sai de graça). Com `bestEffort` (o gerador, que não depende
 * do banco), o banco fora do ar ou com erro não segura o pedido: ele segue
 * sem o aluno.
 */
export function identifyStudent(
  identity: StudentIdentity,
  {
    limit,
    bestEffort,
  }: {
    limit?: RequestHandler;
    /** Diz se o banco está pronto; sem ele, nem tenta. */
    bestEffort?: () => boolean;
  } = {},
): RequestHandler {
  return (req, res, next) => {
    const token = sessionTokenOf(req);
    if (!token || (bestEffort && !bestEffort())) {
      next();
      return;
    }
    const run = () => {
      identity
        .authenticate(token)
        .then(result => {
          if (result.ok) {
            res.locals.student = {
              studentId: result.studentId,
            } satisfies StudentActor;
            next();
            return;
          }
          if (result.reason === 'banned') {
            answer(res, 403, banned(result.ban));
            return;
          }
          answer(res, 401, INVALID_SESSION);
        })
        .catch((err: unknown) => {
          if (bestEffort) next();
          else next(err);
        });
    };
    if (!limit) {
      run();
      return;
    }
    void limit(req, res, (err?: unknown) => {
      if (err) next(err);
      else run();
    });
  };
}

/** Sem a sessão lida pelo `identifyStudent`, 401 `session_required`. */
export const requireStudentSession: RequestHandler = (req, res, next) => {
  if (actorOf(res)) next();
  else answer(res, 401, SESSION_REQUIRED);
};

/**
 * As rotas de aluno que os apps antigos chamam com o token anônimo: a sessão
 * passa; o token passa enquanto `acceptTokens` (`STUDENT_TOKENS=accept`).
 */
export function sessionOrToken({
  token,
  acceptTokens,
}: {
  token: RequestHandler;
  acceptTokens: boolean;
}): RequestHandler {
  return (req, res, next) => {
    if (actorOf(res)) next();
    else if (acceptTokens) token(req, res, next);
    else answer(res, 401, SESSION_REQUIRED);
  };
}

const REFUSALS: Record<
  Exclude<EnrollmentRefusal, 'unavailable' | 'banned'>,
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
  attestation_failed: {
    status: 403,
    body: {
      error: 'attestation_failed',
      message: 'The app, the store install or the device could not be verified',
    },
  },
};

/**
 * A entrada do aluno: `GET /students/challenge` dá o desafio de uso único;
 * `POST /students/session` troca o desafio, a atestação e a matrícula pela
 * sessão; `POST /students/session/end` encerra a sessão (o logout do app).
 */
export function studentRoutes({
  identity,
  withDatabase,
  limit,
}: {
  identity: StudentIdentity;
  withDatabase: RequestHandler;
  limit: RequestHandler;
}) {
  const routes = express.Router();

  const sessionSchema = body({
    challenge: bytesField('challenge', ISSUANCE_CHALLENGE_BYTES),
    installation: bytesField('installation', STUDENT_INSTALLATION_BYTES),
    integrityToken: requiredText('integrityToken', {
      max: INTEGRITY_TOKEN_MAX,
    }),
    // sem os espaços das pontas (o app já manda assim): o hash da atestação
    // usa os dois depois dessa limpeza, como em contract.ts
    matricula: requiredText('matricula', { max: 15, numeric: true }),
    name: requiredText('name', { max: STUDENT_LIMITS.name * 2 }),
  });

  // não grava nada: o desafio leva o próprio HMAC
  routes.get('/students/challenge', limit, (req, res) => {
    const issued = identity.challenge();
    if (!issued) {
      answer(res, 503, UNAVAILABLE);
      return;
    }
    answer(res, 200, {
      challenge: base64url(issued.challenge),
      expiresAt: issued.expiresAt.toISOString(),
    } satisfies StudentChallengeResponse);
  });

  routes.post('/students/session', limit, withDatabase, async (req, res) => {
    const request = parse(sessionSchema, req.body);
    const result = await identity.enroll(request);
    if (result.ok) {
      // sem o aluno: o log não liga as entradas a ninguém
      req.log.info('student signed in');
      answer(res, 201, {
        session: result.token.toString('base64url'),
        expiresAt: result.expiresAt.toISOString(),
        student: { id: result.studentId },
      } satisfies StudentSessionResponse);
      return;
    }
    if (result.reason === 'unavailable') {
      answer(res, 503, UNAVAILABLE);
      return;
    }
    if (result.reason === 'banned' && result.ban) {
      answer(res, 403, banned(result.ban));
      return;
    }
    req.log.info(
      { reason: result.reason, detail: result.detail },
      'student sign-in refused',
    );
    const refusal =
      REFUSALS[result.reason as keyof typeof REFUSALS] ??
      REFUSALS.attestation_failed;
    answer(res, refusal.status, refusal.body);
  });

  routes.post(
    '/students/session/end',
    limit,
    withDatabase,
    async (req, res) => {
      const token = sessionTokenOf(req);
      if (token) await identity.endSession(token);
      answer(res, 200, { status: 'ok' } satisfies OkResponse);
    },
  );

  return routes;
}
