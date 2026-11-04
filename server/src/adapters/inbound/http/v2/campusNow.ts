import express, {
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { z } from 'zod';

import {
  BLOCKS,
  GATES,
  NOTICE_ID,
  NOTICE_KINDS,
  SEEN_LIMIT,
  STATUS_IDS,
  type NoticeView,
} from '../../../../modules/campus-now/domain.ts';
import type {
  CampusNow,
  Earned,
} from '../../../../modules/campus-now/ports.ts';
import type { StudentActor } from '../../../../modules/students/ports.ts';
import { NotFoundError } from '../../../../shared/errors.ts';
import type {
  CampusCommunityResponse,
  CampusEarned,
  CampusNotice,
  CampusNoticeResponse,
  CampusNoticeResultResponse,
  CampusNowResponse,
  CampusYouResponse,
  OkResponse,
} from '../contract.ts';
import { body, parse, stringFor } from '../validation.ts';
import { actorOf } from './students.ts';

const enumField = <T extends string>(field: string, values: readonly T[]) =>
  z.enum(values as [T, ...T[]], {
    error: issue =>
      issue.input === undefined
        ? `${field} is required`
        : `${field} must be one of ${values.join(', ')}`,
  });

const floorField = stringFor('place.floor').max(2, 'place.floor is too long');

const placeSchema = z.discriminatedUnion(
  'type',
  [
    z.object({ type: z.literal('elevators') }),
    z.object({ type: z.literal('ru') }),
    z.object({ type: z.literal('gate'), gate: enumField('place.gate', GATES) }),
    z.object({
      type: z.literal('floor'),
      block: enumField('place.block', BLOCKS),
      floor: floorField,
    }),
    z.object({
      type: z.literal('room'),
      block: enumField('place.block', BLOCKS),
      floor: floorField,
      room: stringFor('place.room').max(12, 'place.room is too long'),
    }),
  ],
  {
    error: issue =>
      issue.input === undefined
        ? 'place is required'
        : 'place.type must be one of elevators, ru, gate, floor, room',
  },
);

const noticeSchema = body({
  kind: enumField('kind', NOTICE_KINDS),
  status: enumField('status', STATUS_IDS),
  place: placeSchema,
});

const answerSchema = body({
  answer: enumField('answer', ['confirm', 'end'] as const),
});

const seenSchema = body({
  ids: z
    .array(stringFor('ids[]'), { error: 'ids must be an array' })
    .max(SEEN_LIMIT, `ids must contain at most ${SEEN_LIMIT} ids`),
});

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthSchema = z.object({
  month: z
    .string({ error: 'month must be a string' })
    .regex(MONTH, 'month must be AAAA-MM')
    .optional(),
});

const noStore = (res: Response) => res.set('Cache-Control', 'no-store');
const iso = (date: Date) => date.toISOString();

function toCampusNotice(view: NoticeView): CampusNotice {
  return {
    id: view.id,
    kind: view.kind,
    status: view.status,
    place: view.place,
    createdAt: iso(view.createdAt),
    expiresAt: iso(view.expiresAt),
    state: view.state,
    confirmations: view.confirmations,
    ends: view.ends,
    confirmed: view.confirmed,
    level: view.level,
    mine: view.mine,
    answer: view.answer,
    thanked: view.thanked,
    flagged: view.flagged,
    views: view.views,
    thanks: view.thanks,
  };
}

const toEarned = (earned: Earned): CampusEarned => ({
  points: earned.points,
  level: earned.level,
  levelAt: earned.levelAt,
  nextLevelAt: earned.nextLevelAt,
  earned: earned.earned,
});

/** O aluno da sessão (a rota só chega aqui com `session`). */
const actor = (res: Response): StudentActor => actorOf(res)!;

/** O id do aviso na rota; malformado, é o mesmo 404 de um que não existe. */
function noticeIdOf(req: Request): string {
  const id = String(req.params.id ?? '');
  if (!NOTICE_ID.test(id))
    throw new NotFoundError(
      'notice_not_found',
      'The notice is over, was removed or never existed',
    );
  return id;
}

/**
 * Agora no campus em `/aouerj/v2/campus-now`, só com a sessão de aluno.
 * Nada fica em cache no caminho (cada aluno vê o que respondeu); o servidor
 * guarda por poucos segundos a parte que é igual para todos. As gravações
 * contam por aluno (`studentLimit`), não pelo IP do Wi-Fi do campus.
 */
export function campusNowRoutes({
  campusNow,
  withDatabase,
  session,
  studentLimit,
}: {
  campusNow: CampusNow;
  withDatabase: RequestHandler;
  /** A sessão exigida (`requireStudentSession`). */
  session: RequestHandler;
  /** As gravações, por aluno, por minuto. */
  studentLimit: RequestHandler;
}) {
  const routes = express.Router();

  routes.get('/campus-now', session, withDatabase, async (req, res) => {
    const list = await campusNow.list(actor(res));
    noStore(res).json({
      notices: list.notices.map(toCampusNotice),
      helpersToday: list.helpersToday,
      you: list.you,
    } satisfies CampusNowResponse);
  });

  routes.post(
    '/campus-now/notices',
    session,
    studentLimit,
    withDatabase,
    async (req, res) => {
      const result = await campusNow.report(
        parse(noticeSchema, req.body),
        actor(res),
      );
      noStore(res)
        .status(201)
        .json({
          notice: toCampusNotice(result.notice),
          merged: result.merged,
          replaced: result.replaced,
          you: toEarned(result.you),
        } satisfies CampusNoticeResultResponse);
    },
  );

  routes.post(
    '/campus-now/notices/:id/answer',
    session,
    studentLimit,
    withDatabase,
    async (req, res) => {
      const id = noticeIdOf(req);
      const { answer } = parse(answerSchema, req.body);
      const result = await campusNow.answer(id, answer, actor(res));
      noStore(res).json({
        notice: toCampusNotice(result.notice),
        you: toEarned(result.you),
      } satisfies CampusNoticeResponse);
    },
  );

  routes.post(
    '/campus-now/notices/:id/thanks',
    session,
    studentLimit,
    withDatabase,
    async (req, res) => {
      const result = await campusNow.thank(noticeIdOf(req), actor(res));
      noStore(res).json({
        notice: toCampusNotice(result.notice),
        you: toEarned(result.you),
      } satisfies CampusNoticeResponse);
    },
  );

  routes.post(
    '/campus-now/notices/:id/flag',
    session,
    studentLimit,
    withDatabase,
    async (req, res) => {
      await campusNow.flag(noticeIdOf(req), actor(res));
      noStore(res).json({ status: 'ok' } satisfies OkResponse);
    },
  );

  routes.post(
    '/campus-now/seen',
    session,
    studentLimit,
    withDatabase,
    async (req, res) => {
      const { ids } = parse(seenSchema, req.body);
      await campusNow.seen(
        ids.filter(id => NOTICE_ID.test(id)),
        actor(res),
      );
      noStore(res).json({ status: 'ok' } satisfies OkResponse);
    },
  );

  routes.get('/campus-now/you', session, withDatabase, async (req, res) => {
    const summary = await campusNow.you(actor(res));
    noStore(res).json({
      you: summary.you,
      counts: summary.counts,
      week: summary.week,
      today: summary.today.map(toCampusNotice),
    } satisfies CampusYouResponse);
  });

  routes.get(
    '/campus-now/community',
    session,
    withDatabase,
    async (req, res) => {
      const { month } = parse(monthSchema, req.query);
      const community = await campusNow.community(month ?? null);
      noStore(res).json(community satisfies CampusCommunityResponse);
    },
  );

  return routes;
}
