import express, {
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { z } from 'zod';

import { ISSUANCE_CHALLENGE_BYTES } from '../../../../modules/access/domain.ts';
import {
  STUDENT_INSTALLATION_BYTES,
  STUDENT_LIMITS,
  type Ban,
} from '../../../../modules/students/domain.ts';
import type {
  EnrollmentAttestation,
  EnrollmentRefusal,
  StudentActor,
  StudentIdentity,
} from '../../../../modules/students/ports.ts';
import { InvalidInputError } from '../../../../shared/errors.ts';
import type {
  ApiError,
  OkResponse,
  StudentBannedError,
  StudentChallengeResponse,
  StudentSessionResponse,
} from '../contract.ts';
import { body, parse, requiredText, stringFor } from '../validation.ts';
import { base64url, bytesField } from './base64url.ts';

/** Um token de integridade da Play tem uns poucos KB. */
const INTEGRITY_TOKEN_MAX = 16 * 1024;

/**
 * O objeto de atestação do App Attest tem uns 5 KB (os dois certificados e o
 * recibo), uns 7 000 caracteres em base64: o teto fica bem acima.
 */
const APP_ATTESTATION_MAX = 32 * 1024;

/** O keyId do App Attest: o SHA-256 da chave, em base64 (44 caracteres). */
const APP_ATTEST_KEY_ID_BYTES = 32;

/** Base64 padrão, como o iOS escreve: com o `=` do fim e sem quebra de linha. */
const BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/**
 * Um campo em base64 padrão, de até `max` caracteres, em bytes. Só a forma
 * canônica (a que volta igual), para dois textos não darem os mesmos bytes.
 */
const base64Field = (
  field: string,
  { max, bytes }: { max: number; bytes?: number },
) =>
  stringFor(field)
    .max(max, `${field} must be at most ${max} characters`)
    .refine(
      value =>
        value.length > 0 &&
        BASE64.test(value) &&
        Buffer.from(value, 'base64').toString('base64') === value,
      `${field} must be base64`,
    )
    .transform(value => Buffer.from(value, 'base64'))
    .refine(
      decoded => bytes === undefined || decoded.length === bytes,
      `${field} must have ${bytes} bytes`,
    );

/** Ausente ou `null` é ausente; presente, `schema` confere. */
const optionalField = <T extends z.ZodType>(schema: T) =>
  z.preprocess(value => value ?? undefined, schema.optional()).optional();

/** O App Attest do iPhone, como em `StudentAppAttest`. */
const appAttestSchema = z.object(
  {
    keyId: base64Field('keyId', {
      max: 64,
      bytes: APP_ATTEST_KEY_ID_BYTES,
    }),
    attestation: base64Field('attestation', { max: APP_ATTESTATION_MAX }),
  },
  { error: 'appAttest must be an object' },
);

/**
 * A atestação do pedido: o token da Play Integrity (Android) ou o App Attest
 * (iPhone), um dos dois e nunca os dois.
 */
function attestationOf({
  integrityToken,
  appAttest,
}: {
  integrityToken?: string | undefined;
  appAttest?: { keyId: Buffer; attestation: Buffer } | undefined;
}): EnrollmentAttestation {
  if (integrityToken !== undefined && appAttest !== undefined)
    throw new InvalidInputError('send integrityToken or appAttest, not both');
  if (integrityToken !== undefined) return { integrityToken };
  if (appAttest !== undefined) return { appAttest };
  throw new InvalidInputError('integrityToken or appAttest is required');
}

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

/** Onde o `identifyStudent` deixa o aluno que o cache conhecia. */
const PEEKED = 'peekedStudent';

/**
 * Lê a sessão, se o pedido trouxer uma (`Authorization: Student …`): válida,
 * guarda o aluno em `res.locals.student`; vencida, 401; banido, 403 com o
 * prazo. Sem sessão, segue: quem exige é o `requireStudentSession`.
 *
 * Os limites vêm antes do banco, só para quem manda uma sessão. A sessão que
 * o cache já conhece conta pelo aluno (`studentLimit`, que lê o id com
 * `peekedStudentOf`): o Wi-Fi da UERJ põe muitos alunos num IP só, e eles não
 * dividem um teto. A desconhecida (a primeira do processo, um token
 * inventado) conta pelo IP (`limit`): um token inventado não sai de graça.
 * Com `bestEffort` (o gerador, que não depende do banco), o banco fora do ar
 * ou com erro não segura o pedido: ele segue sem o aluno.
 */
export function identifyStudent(
  identity: StudentIdentity,
  {
    limit,
    studentLimit,
    bestEffort,
  }: {
    /** Por IP: as sessões que o cache não conhece. */
    limit?: RequestHandler;
    /** Por aluno: as sessões que o cache conhece. */
    studentLimit?: RequestHandler;
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
    // a sessão que o cache já conhece conta pelo aluno, não pelo IP
    const known = studentLimit ? identity.peek(token) : null;
    if (known) res.locals[PEEKED] = known.studentId;
    const gate = known ? studentLimit : limit;
    if (!gate) {
      run();
      return;
    }
    void gate(req, res, (err?: unknown) => {
      if (err) next(err);
      else run();
    });
  };
}

/**
 * O aluno que o cache conhecia neste pedido, para a chave do limite por
 * aluno (`perKeyLimit`); `undefined` nos outros.
 */
export const peekedStudentOf = (req: Request): string | undefined => {
  const value: unknown = req.res?.locals[PEEKED];
  return typeof value === 'string' ? value : undefined;
};

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
 * `POST /students/session` troca o desafio, a atestação (a Play Integrity no
 * Android, o App Attest no iPhone) e a matrícula pela sessão;
 * `POST /students/session/end` encerra a sessão (o logout do app).
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
    // um dos dois (o `attestationOf` confere)
    integrityToken: optionalField(
      requiredText('integrityToken', { max: INTEGRITY_TOKEN_MAX }),
    ),
    appAttest: optionalField(appAttestSchema),
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
    const { integrityToken, appAttest, ...fields } = parse(
      sessionSchema,
      req.body,
    );
    const attestation = attestationOf({ integrityToken, appAttest });
    // de qual aparelho, para o log: não identifica ninguém
    const platform = attestation.appAttest ? 'ios' : 'android';
    const result = await identity.enroll({ ...fields, ...attestation });
    if (result.ok) {
      // sem o aluno: o log não liga as entradas a ninguém
      req.log.info({ platform }, 'student signed in');
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
      { reason: result.reason, detail: result.detail, platform },
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
