import axios from 'axios';
import { AppError } from '@root/shared/errors/AppError';
import {
  CampusNowError,
  NOTICE_BLOCKS,
  NOTICE_GATES,
  NOTICE_KINDS,
  NOTICE_STATUSES,
  type CampusNotice,
  type CampusProblem,
  type CommunitySummary,
  type Earned,
  type NoticeAnswer,
  type NoticeBlock,
  type NoticePlace,
  type NoticeRefusal,
  type NoticeState,
  type Standing,
  type YouSummary,
} from '@root/modules/campus-now/domain/campusNow';
import type { CampusNowServerPort } from '@root/modules/campus-now/application/ports';
// O contrato do servidor (server/); só tipos, apagados no bundle.
import type {
  CampusAnswerRequest,
  CampusCommunityResponse,
  CampusNoticeRequest,
  CampusNoticeResponse,
  CampusNoticeResultResponse,
  CampusNowResponse,
  CampusSeenRequest,
  CampusYouResponse,
} from '../../../../server/src/adapters/inbound/http/contract';
import type { PrivateApiHttpClient } from './index';

const BASE = '/v2/campus-now';

const STATES: readonly NoticeState[] = [
  'active',
  'ended',
  'expired',
  'removed',
];
const ANSWERS: readonly NoticeAnswer[] = ['confirm', 'end'];
const FLOOR = /^(SE|T|[1-9]|1[0-2])$/;
const ROOM = /^[A-Z0-9]{2,6}$/;
/** Até quantos ids vão num "viram" (o servidor aceita 50). */
const SEEN_BATCH = 50;

const broken = () => new AppError('SERVICE_UNAVAILABLE');

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw broken();
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw broken();
  return value;
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
    throw broken();
  return value;
}
function flag(value: unknown): boolean {
  if (typeof value !== 'boolean') throw broken();
  return value;
}
function time(value: unknown): number {
  const parsed = Date.parse(text(value));
  if (Number.isNaN(parsed)) throw broken();
  return parsed;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw broken();
  return value;
}
function oneOf<T extends string>(values: readonly T[], value: unknown): T {
  if (!values.includes(value as T)) throw broken();
  return value as T;
}
function nullable<T>(value: unknown, read: (value: unknown) => T): T | null {
  return value === null || value === undefined ? null : read(value);
}
function floor(value: unknown): string {
  const raw = text(value);
  if (!FLOOR.test(raw)) throw broken();
  return raw;
}

function place(value: unknown): NoticePlace {
  const data = object(value);
  switch (data.type) {
    case 'elevators':
      return { type: 'elevators' };
    case 'ru':
      return { type: 'ru' };
    case 'gate':
      return { type: 'gate', gate: oneOf(NOTICE_GATES, data.gate) };
    case 'floor':
      return {
        type: 'floor',
        block: oneOf<NoticeBlock>(NOTICE_BLOCKS, data.block),
        floor: floor(data.floor),
      };
    case 'room': {
      const room = text(data.room);
      if (!ROOM.test(room)) throw broken();
      return {
        type: 'room',
        block: oneOf<NoticeBlock>(NOTICE_BLOCKS, data.block),
        floor: floor(data.floor),
        room,
      };
    }
    default:
      throw broken();
  }
}

function notice(value: unknown): CampusNotice {
  const data = object(value);
  return {
    id: text(data.id),
    kind: oneOf(NOTICE_KINDS, data.kind),
    status: oneOf(NOTICE_STATUSES, data.status),
    place: place(data.place),
    createdAt: time(data.createdAt),
    expiresAt: time(data.expiresAt),
    state: oneOf(STATES, data.state),
    confirmations: count(data.confirmations),
    ends: count(data.ends),
    confirmed: flag(data.confirmed),
    level: nullable(data.level, count),
    mine: flag(data.mine),
    answer: nullable(data.answer, raw => oneOf(ANSWERS, raw)),
    thanked: flag(data.thanked),
    flagged: flag(data.flagged),
    views: nullable(data.views, count),
    thanks: nullable(data.thanks, count),
  };
}

function standing(value: unknown): Standing {
  const data = object(value);
  return {
    points: count(data.points),
    level: count(data.level),
    levelAt: count(data.levelAt),
    nextLevelAt: nullable(data.nextLevelAt, count),
  };
}

function earned(value: unknown): Earned {
  const data = object(value);
  const points = data.earned;
  if (typeof points !== 'number' || !Number.isInteger(points)) throw broken();
  return { ...standing(data), earned: points };
}

function problem(value: unknown): CampusProblem {
  const data = object(value);
  return {
    kind: oneOf(NOTICE_KINDS, data.kind),
    status: oneOf(NOTICE_STATUSES, data.status),
    block: nullable(data.block, raw => oneOf(NOTICE_BLOCKS, raw)),
    gate: nullable(data.gate, raw => oneOf(NOTICE_GATES, raw)),
    days: count(data.days),
    notices: count(data.notices),
    minutesToEnd: nullable(data.minutesToEnd, minutes),
    peakHours: list(data.peakHours).map(raw => {
      const hour = count(raw);
      if (hour > 23) throw broken();
      return hour;
    }),
  };
}

function minutes(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw broken();
  return value;
}

/** As recusas que o servidor documenta em contract.ts. */
const REFUSALS: Record<string, NoticeRefusal> = {
  notice_not_found: 'gone',
  own_notice: 'own',
  already_answered: 'answered',
  invalid_place: 'place',
  notice_limit_reached: 'limit',
  campus_full: 'full',
};

async function request<T>(execute: () => Promise<T>): Promise<T> {
  try {
    return await execute();
  } catch (error) {
    if (error instanceof AppError || error instanceof CampusNowError)
      throw error;
    if (axios.isCancel(error)) throw new AppError('CANCELLED');
    if (axios.isAxiosError(error)) {
      const response = error.response;
      if (!response) throw new AppError('NETWORK');
      const code = (response.data as { error?: unknown } | undefined)?.error;
      const refusal = typeof code === 'string' ? REFUSALS[code] : undefined;
      if (refusal) throw new CampusNowError(refusal);
      if (response.status === 429) throw new AppError('RATE_LIMITED');
      if (response.status === 400) throw new AppError('INVALID_INPUT');
      throw broken();
    }
    throw broken();
  }
}

const path = (id: string, action: string) =>
  `${BASE}/notices/${encodeURIComponent(id)}/${action}`;

/**
 * O Agora no campus no servidor, com a sessão de aluno em todo pedido
 * (`client` é o cliente com a sessão).
 */
export function createCampusNowServer(
  client: PrivateApiHttpClient,
): CampusNowServerPort {
  return {
    list: options =>
      request(async () => {
        const { data } = await client.get(BASE, options);
        const body = object(data) as Partial<CampusNowResponse>;
        return {
          notices: list(body.notices).map(notice),
          helpersToday: count(body.helpersToday),
          you: standing(body.you),
        };
      }),
    report: input =>
      request(async () => {
        const { data } = await client.post(`${BASE}/notices`, {
          kind: input.kind,
          status: input.status,
          place: input.place,
        } satisfies CampusNoticeRequest);
        const body = object(data) as Partial<CampusNoticeResultResponse>;
        return {
          notice: notice(body.notice),
          merged: flag(body.merged),
          replaced: nullable(body.replaced, text),
          you: earned(body.you),
        };
      }),
    answer: (id, answer) =>
      request(async () => {
        const { data } = await client.post(path(id, 'answer'), {
          answer,
        } satisfies CampusAnswerRequest);
        const body = object(data) as Partial<CampusNoticeResponse>;
        return { notice: notice(body.notice), you: earned(body.you) };
      }),
    thank: id =>
      request(async () => {
        const { data } = await client.post(path(id, 'thanks'), {});
        const body = object(data) as Partial<CampusNoticeResponse>;
        return { notice: notice(body.notice), you: earned(body.you) };
      }),
    flag: id =>
      request(async () => {
        await client.post(path(id, 'flag'), {});
      }),
    seen: ids =>
      request(async () => {
        for (let start = 0; start < ids.length; start += SEEN_BATCH)
          await client.post(`${BASE}/seen`, {
            ids: ids.slice(start, start + SEEN_BATCH),
          } satisfies CampusSeenRequest);
      }),
    you: options =>
      request(async () => {
        const { data } = await client.get(`${BASE}/you`, options);
        const body = object(data) as Partial<CampusYouResponse>;
        const counts = object(body.counts);
        const week = object(body.week);
        return {
          you: standing(body.you),
          counts: {
            notices: count(counts.notices),
            answers: count(counts.answers),
            confirmedNotices: count(counts.confirmedNotices),
            thanksReceived: count(counts.thanksReceived),
            viewsReceived: count(counts.viewsReceived),
          },
          week: {
            notices: count(week.notices),
            views: count(week.views),
            thanks: count(week.thanks),
          },
          today: list(body.today).map(notice),
        } satisfies YouSummary;
      }),
    community: (month, options) =>
      request(async () => {
        const { data } = await client.get(
          `${BASE}/community?month=${encodeURIComponent(month)}`,
          options,
        );
        const body = object(data) as Partial<CampusCommunityResponse>;
        const week = object(body.week);
        const summary = object(body.month);
        return {
          week: {
            from: text(week.from),
            notices: count(week.notices),
            answers: count(week.answers),
            views: count(week.views),
            minutesToEnd: nullable(week.minutesToEnd, minutes),
          },
          month: {
            month: text(summary.month),
            weekdays: count(summary.weekdays),
            notices: count(summary.notices),
            problems: list(summary.problems).map(problem),
          },
        } satisfies CommunitySummary;
      }),
  };
}
