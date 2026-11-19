import axios from 'axios';
import { AppError } from '@root/shared/errors/AppError';
import {
  IDEA_AREAS,
  IDEA_FIELDS,
  IDEA_STATUSES,
  ISSUE_STATUSES,
  IdeaError,
  type IdeaField,
  type IdeaRefusal,
  type MyIdea,
  type SimilarIdea,
} from '@root/modules/ideas/domain/ideas';
import type { IdeasServerPort } from '@root/modules/ideas/application/ports';
// O contrato do servidor (server/); só tipos, apagados no bundle.
import type {
  IdeaResponse,
  IdeaVoteRequest,
  MyIdeasResponse,
  NewIdeaRequest,
  SimilarIdeasRequest,
  SimilarIdeasResponse,
} from '../../../../server/src/adapters/inbound/http/contract';
import type { PrivateApiHttpClient } from './index';

const BASE = '/v2/ideas';
/** O app só abre o issue no GitHub. */
const ISSUE_URL = /^https:\/\/github\.com\/[^\s]+$/;

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
function issueNumber(value: unknown): number {
  const number = count(value);
  if (number < 1) throw broken();
  return number;
}
function url(value: unknown): string {
  const raw = text(value);
  if (!ISSUE_URL.test(raw)) throw broken();
  return raw;
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

function idea(value: unknown): MyIdea {
  const data = object(value);
  const issue = data.issue == null ? null : object(data.issue);
  return {
    id: text(data.id),
    kind: oneOf(['sent', 'joined'] as const, data.kind),
    title: text(data.title),
    area: data.area == null ? null : oneOf(IDEA_AREAS, data.area),
    createdAt: time(data.createdAt),
    status: oneOf(IDEA_STATUSES, data.status),
    issue: issue
      ? { number: issueNumber(issue.number), url: url(issue.url) }
      : null,
    requests: count(data.requests),
  };
}

function similar(value: unknown): SimilarIdea {
  const data = object(value);
  return {
    number: issueNumber(data.number),
    title: text(data.title),
    url: url(data.url),
    status: oneOf(ISSUE_STATUSES, data.status),
    requests: count(data.requests),
  };
}

/** As recusas que o servidor documenta em contract.ts. */
const REFUSALS: Record<string, IdeaRefusal> = {
  idea_contact: 'contact',
  idea_limit: 'limit',
  issue_not_found: 'gone',
  suggestions_unavailable: 'github',
  github_unavailable: 'github',
};

/** "The problem cannot carry…": o campo que o servidor recusou. */
function contactField(message: unknown): IdeaField | null {
  if (typeof message !== 'string') return null;
  const match = /^The (\w+)\b/.exec(message);
  return IDEA_FIELDS.find(field => field === match?.[1]) ?? null;
}

async function request<T>(execute: () => Promise<T>): Promise<T> {
  try {
    return await execute();
  } catch (error) {
    if (error instanceof AppError || error instanceof IdeaError) throw error;
    if (axios.isCancel(error)) throw new AppError('CANCELLED');
    if (axios.isAxiosError(error)) {
      const response = error.response;
      if (!response) throw new AppError('NETWORK');
      const data = response.data as
        { error?: unknown; message?: unknown } | undefined;
      const refusal =
        typeof data?.error === 'string' ? REFUSALS[data.error] : undefined;
      if (refusal)
        throw new IdeaError(
          refusal,
          refusal === 'contact' ? contactField(data?.message) : null,
        );
      if (response.status === 429) throw new AppError('RATE_LIMITED');
      if (response.status === 400) throw new AppError('INVALID_INPUT');
      throw broken();
    }
    throw broken();
  }
}

/**
 * As sugestões no servidor, com a sessão de aluno em todo pedido (`client`
 * é o cliente com a sessão).
 */
export function createIdeasServer(
  client: PrivateApiHttpClient,
): IdeasServerPort {
  return {
    mine: options =>
      request(async () => {
        const { data } = await client.get(BASE, options);
        const body = object(data) as Partial<MyIdeasResponse>;
        return {
          ideas: list(body.ideas).map(idea),
          remainingToday: count(body.remainingToday),
        };
      }),
    similar: (searched, options) =>
      request(async () => {
        const { data } = await client.post(
          `${BASE}/similar`,
          { text: searched } satisfies SimilarIdeasRequest,
          options,
        );
        const body = object(data) as Partial<SimilarIdeasResponse>;
        return list(body.similar).map(similar);
      }),
    submit: sent =>
      request(async () => {
        const { data } = await client.post(BASE, {
          title: sent.title,
          area: sent.area,
          problem: sent.problem,
          ...(sent.idea ? { idea: sent.idea } : {}),
          portal: sent.portal,
          appVersion: sent.appVersion,
          platform: sent.platform,
          ...(sent.seenSimilar.length ? { seenSimilar: sent.seenSimilar } : {}),
        } satisfies NewIdeaRequest);
        return idea((object(data) as Partial<IdeaResponse>).idea);
      }),
    vote: issue =>
      request(async () => {
        const { data } = await client.post(`${BASE}/votes`, {
          issue,
        } satisfies IdeaVoteRequest);
        return idea((object(data) as Partial<IdeaResponse>).idea);
      }),
  };
}
