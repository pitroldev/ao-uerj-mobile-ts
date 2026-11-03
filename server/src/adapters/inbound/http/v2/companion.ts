import express, {
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { z } from 'zod';

import type { StudentAccess } from '../../../../modules/access/ports.ts';
import {
  CALL_KINDS,
  COMPANION_LIMITS,
  DESTINATIONS,
  MEMBER_KEY_BYTES,
  PHRASE_IDS,
  REPORT_REASONS,
  SPOT_IDS,
  viewerId,
  type MemberCall,
  type PublicCall,
} from '../../../../modules/companion/domain.ts';
import type { Companion } from '../../../../modules/companion/ports.ts';
import { ForbiddenError, NotFoundError } from '../../../../shared/errors.ts';
import type {
  ApiError,
  CompanionCall,
  CompanionCallListResponse,
  CompanionCallResponse,
  CompanionMemberCall,
  CompanionMembershipResponse,
  OkResponse,
  StudentPassResponse,
} from '../contract.ts';
import { body, parse, required, stringFor } from '../validation.ts';

const MEMBER_KEY = /^[A-Za-z0-9_-]{43}$/;

const enumField = <T extends string>(field: string, values: readonly T[]) =>
  z.enum(values as [T, ...T[]], {
    error: issue =>
      issue.input === undefined
        ? `${field} is required`
        : `${field} must be one of ${values.join(', ')}`,
  });

const nameField = stringFor('name').max(
  COMPANION_LIMITS.name * 2,
  `name must be at most ${COMPANION_LIMITS.name} characters`,
);

const openSchema = body({
  kind: enumField('kind', CALL_KINDS),
  at: stringFor('at')
    .refine(value => !Number.isNaN(Date.parse(value)), 'at must be a date')
    .transform(value => new Date(value)),
  spot: enumField('spot', SPOT_IDS),
  destination: z
    .preprocess(
      value => value ?? null,
      enumField('destination', DESTINATIONS).nullable(),
    )
    .optional()
    .transform(value => value ?? null),
  note: z
    .preprocess(
      value => value ?? '',
      stringFor('note').max(
        COMPANION_LIMITS.note * 2,
        `note must be at most ${COMPANION_LIMITS.note} characters`,
      ),
    )
    .optional()
    .transform(value => value ?? ''),
  capacity: z.number({ error: required('capacity', 'a number') }),
  name: nameField,
});

const joinSchema = body({ name: nameField });
const phraseSchema = body({ phrase: enumField('phrase', PHRASE_IDS) });
const reportSchema = body({ reason: enumField('reason', REPORT_REASONS) });

const noStore = (res: Response) => res.set('Cache-Control', 'no-store');

const iso = (date: Date) => date.toISOString();

function toCompanionCall(call: PublicCall): CompanionCall {
  return {
    id: call.id,
    kind: call.kind,
    at: iso(call.at),
    spot: call.spot,
    destination: call.destination,
    note: call.note,
    host: call.host,
    going: call.going,
    capacity: call.capacity,
    listedUntil: iso(call.listedUntil),
    expiresAt: iso(call.expiresAt),
  };
}

function toMemberCall(call: MemberCall): CompanionMemberCall {
  return {
    ...toCompanionCall(call),
    endedAt: call.endedAt ? iso(call.endedAt) : null,
    members: call.members,
    feed: call.feed.map(entry => ({ ...entry, at: iso(entry.at) })),
  };
}

/** A chave de membro do cabeçalho; sem ela (ou malformada), 403. */
function memberKeyOf(req: Request): Buffer {
  const header = req.get('x-member-key') ?? '';
  if (!MEMBER_KEY.test(header))
    throw new ForbiddenError('not_a_member', 'X-Member-Key is required');
  const key = Buffer.from(header, 'base64url');
  if (key.length !== MEMBER_KEY_BYTES)
    throw new ForbiddenError('not_a_member', 'X-Member-Key is malformed');
  return key;
}

const callIdOf = (req: Request) => String(req.params.id ?? '');

/** O apelido do membro: 11 caracteres base64url. */
const MEMBER_REF = /^[A-Za-z0-9_-]{11}$/;

/**
 * A Companhia agora em `/aouerj/v2/companion`. As leituras da lista levam o
 * passe de aluno; abrir, entrar e denunciar de fora gastam um token (o
 * `student` que vem do roteador); o resto, a chave de membro. Nada fica em
 * cache: as vagas mudam a cada minuto.
 *
 * Limites: o token já é o limite de quem abre, entra e pede o passe, então
 * o IP só tem um teto folgado (`campusLimit`); o que usa a chave de membro
 * conta por chave (`memberLimit`).
 */
export function companionRoutes({
  companion,
  access,
  withDatabase,
  student,
  campusLimit,
  memberLimit,
}: {
  companion: Companion;
  access: StudentAccess;
  withDatabase: RequestHandler;
  student: RequestHandler;
  campusLimit: RequestHandler;
  memberLimit: RequestHandler;
}) {
  const routes = express.Router();

  const withPass: RequestHandler = (req, res, next) => {
    if (access.checkPass(req.get('x-student-pass'))) {
      next();
      return;
    }
    noStore(res)
      .status(401)
      .json({
        error: 'invalid_pass',
        message: 'A valid student pass is required; get a new one',
      } satisfies ApiError);
  };

  // gasta um token e devolve o passe de uma hora de leituras
  routes.post(
    '/companion/pass',
    campusLimit,
    withDatabase,
    student,
    (req, res) => {
      const issued = access.issuePass();
      if (!issued) {
        noStore(res)
          .status(503)
          .json({
            error: 'student_access_unavailable',
            message: 'Student access is not available right now',
          } satisfies ApiError);
        return;
      }
      noStore(res).json({
        pass: issued.pass.toString('base64url'),
        expiresAt: iso(issued.expiresAt),
      } satisfies StudentPassResponse);
    },
  );

  routes.get('/companion/calls', withPass, withDatabase, async (req, res) => {
    // quem olha conta em "de olho agora" pelo hash do passe, nada mais
    const { calls, watching } = await companion.list(
      viewerId(req.get('x-student-pass') ?? ''),
    );
    noStore(res).json({
      calls: calls.map(toCompanionCall),
      watching,
    } satisfies CompanionCallListResponse);
  });

  routes.post(
    '/companion/calls',
    campusLimit,
    withDatabase,
    student,
    async (req, res) => {
      const { call, memberKey } = await companion.open(
        parse(openSchema, req.body),
      );
      noStore(res)
        .status(201)
        .json({
          call: toMemberCall(call),
          memberKey: memberKey.toString('base64url'),
        } satisfies CompanionMembershipResponse);
    },
  );

  routes.get('/companion/calls/:id', withDatabase, async (req, res) => {
    const call = await companion.read(callIdOf(req), memberKeyOf(req));
    noStore(res).json({
      call: toMemberCall(call),
    } satisfies CompanionCallResponse);
  });

  routes.post(
    '/companion/calls/:id/members',
    campusLimit,
    withDatabase,
    student,
    async (req, res) => {
      const { name } = parse(joinSchema, req.body);
      const { call, memberKey } = await companion.join(callIdOf(req), name);
      noStore(res)
        .status(201)
        .json({
          call: toMemberCall(call),
          memberKey: memberKey.toString('base64url'),
        } satisfies CompanionMembershipResponse);
    },
  );

  routes.post(
    '/companion/calls/:id/leave',
    campusLimit,
    memberLimit,
    withDatabase,
    async (req, res) => {
      await companion.leave(callIdOf(req), memberKeyOf(req));
      noStore(res).json({ status: 'ok' } satisfies OkResponse);
    },
  );

  // quem chamou tira alguém pelo apelido (só os membros o veem)
  routes.post(
    '/companion/calls/:id/members/:ref/remove',
    campusLimit,
    memberLimit,
    withDatabase,
    async (req, res) => {
      const ref = String(req.params.ref ?? '');
      if (!MEMBER_REF.test(ref))
        throw new NotFoundError(
          'member_not_found',
          'Nobody in this call has that ref',
        );
      const call = await companion.remove(callIdOf(req), memberKeyOf(req), ref);
      noStore(res).json({
        call: toMemberCall(call),
      } satisfies CompanionCallResponse);
    },
  );

  routes.post(
    '/companion/calls/:id/phrases',
    campusLimit,
    memberLimit,
    withDatabase,
    async (req, res) => {
      const { phrase } = parse(phraseSchema, req.body);
      const call = await companion.say(callIdOf(req), memberKeyOf(req), phrase);
      noStore(res).json({
        call: toMemberCall(call),
      } satisfies CompanionCallResponse);
    },
  );

  // de dentro, a chave de membro; de fora, um token (o `student`)
  const reporter: RequestHandler = (req, res, next) => {
    if (req.get('x-member-key')) {
      next();
      return;
    }
    student(req, res, next);
  };
  routes.post(
    '/companion/calls/:id/reports',
    campusLimit,
    memberLimit,
    withDatabase,
    reporter,
    async (req, res) => {
      const { reason } = parse(reportSchema, req.body);
      await companion.report(
        callIdOf(req),
        req.get('x-member-key')
          ? { memberKey: memberKeyOf(req) }
          : { outsider: true },
        reason,
      );
      noStore(res).json({ status: 'ok' } satisfies OkResponse);
    },
  );

  return routes;
}
