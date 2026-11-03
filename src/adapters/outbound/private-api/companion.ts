import axios from 'axios';
import { AppError } from '@root/shared/errors/AppError';
import {
  CALL_KINDS,
  CompanionError,
  DESTINATION_IDS,
  type CallKind,
  type CallList,
  type CallMember,
  type CallPhrase,
  type CompanionCall,
  type CompanionRefusal,
  type DestinationId,
  type MemberCall,
  type PhraseId,
  type SpotId,
} from '@root/modules/companion/domain/companion';
import type {
  CompanionServerPort,
  JoinedCall,
} from '@root/modules/companion/application/ports';
// O contrato do servidor (server/); só tipos, apagados no bundle.
import type {
  CompanionCallListResponse,
  CompanionCallResponse,
  CompanionMembershipResponse,
  CompanionPhraseRequest,
  CompanionReportRequest,
  JoinCompanionCallRequest,
  OpenCompanionCallRequest,
  StudentPassResponse,
} from '../../../../server/src/adapters/inbound/http/contract';
import type { PrivateApiHttpClient } from './index';

const BASE = '/v2/companion';

const SPOTS: readonly SpotId[] = [
  'ru',
  'lago',
  'concha',
  'portao-1',
  'portao-5',
];
const PHRASES: readonly PhraseId[] = [
  'on_my_way',
  'at_spot',
  'late',
  'home_safe',
];

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

function call(value: unknown): CompanionCall {
  const data = object(value);
  return {
    id: text(data.id),
    kind: oneOf<CallKind>(CALL_KINDS, data.kind),
    at: time(data.at),
    spot: oneOf(SPOTS, data.spot),
    destination:
      data.destination === null
        ? null
        : oneOf<DestinationId>(DESTINATION_IDS, data.destination),
    note: text(data.note),
    host: text(data.host),
    going: count(data.going),
    capacity: count(data.capacity),
    listedUntil: time(data.listedUntil),
    expiresAt: time(data.expiresAt),
  };
}

function member(value: unknown): CallMember {
  const data = object(value);
  return {
    ref: text(data.ref),
    name: text(data.name),
    host: flag(data.host),
    you: flag(data.you),
  };
}

function phrase(value: unknown): CallPhrase {
  const data = object(value);
  return {
    name: text(data.name),
    phrase: oneOf(PHRASES, data.phrase),
    at: time(data.at),
    you: flag(data.you),
  };
}

function memberCall(value: unknown): MemberCall {
  const data = object(value);
  return {
    ...call(data),
    endedAt: data.endedAt === null ? null : time(data.endedAt),
    members: list(data.members).map(member),
    feed: list(data.feed).map(phrase),
  };
}

function joined(value: unknown): JoinedCall {
  const data = object(value);
  return { call: memberCall(data.call), memberKey: text(data.memberKey) };
}

/** As recusas que o servidor documenta em contract.ts. */
const REFUSALS: Record<string, CompanionRefusal> = {
  call_not_found: 'gone',
  call_full: 'full',
  call_closed: 'closed',
  call_ended: 'ended',
  note_not_allowed: 'contact',
  not_a_member: 'not_member',
  removed_from_call: 'removed',
  not_the_host: 'not_host',
  member_not_found: 'member_gone',
  cannot_remove_host: 'not_host',
  companion_full: 'busy',
  invalid_pass: 'pass_expired',
};

async function request<T>(execute: () => Promise<T>): Promise<T> {
  try {
    return await execute();
  } catch (error) {
    if (error instanceof AppError || error instanceof CompanionError)
      throw error;
    if (axios.isCancel(error)) throw new AppError('CANCELLED');
    if (axios.isAxiosError(error)) {
      const response = error.response;
      if (!response) throw new AppError('NETWORK');
      const code = (response.data as { error?: unknown } | undefined)?.error;
      const refusal = typeof code === 'string' ? REFUSALS[code] : undefined;
      if (refusal) throw new CompanionError(refusal);
      if (response.status === 429) throw new AppError('RATE_LIMITED');
      if (response.status === 400) throw new AppError('INVALID_INPUT');
      throw broken();
    }
    throw broken();
  }
}

const memberHeaders = (memberKey: string) => ({ 'X-Member-Key': memberKey });

/**
 * A Companhia agora no servidor. `student` leva um token anônimo por
 * requisição (abrir, entrar, o passe, a denúncia de fora); `client`, o
 * passe ou a chave de membro no cabeçalho.
 */
export function createCompanionServer(
  client: PrivateApiHttpClient,
  student: PrivateApiHttpClient,
): CompanionServerPort {
  return {
    pass: () =>
      request(async () => {
        const { data } = await student.post(`${BASE}/pass`, {});
        const body = object(data) as Partial<StudentPassResponse>;
        return { pass: text(body.pass), expiresAt: time(body.expiresAt) };
      }),
    list: (pass, options) =>
      request(async () => {
        const { data } = await client.get(`${BASE}/calls`, {
          ...options,
          headers: { 'X-Student-Pass': pass },
        });
        const body = object(data) as Partial<CompanionCallListResponse>;
        // um servidor de antes do campo manda só a lista
        const watching = body.watching === undefined ? 0 : count(body.watching);
        return {
          calls: list(body.calls).map(call),
          watching,
        } satisfies CallList;
      }),
    open: input =>
      request(async () => {
        const { data } = await student.post(`${BASE}/calls`, {
          kind: input.kind,
          at: new Date(input.at).toISOString(),
          spot: input.spot,
          destination: input.destination,
          note: input.note,
          capacity: input.capacity,
          name: input.name,
        } satisfies OpenCompanionCallRequest);
        const body = object(data) as Partial<CompanionMembershipResponse>;
        return joined(body);
      }),
    join: (callId, name) =>
      request(async () => {
        const { data } = await student.post(
          `${BASE}/calls/${encodeURIComponent(callId)}/members`,
          { name } satisfies JoinCompanionCallRequest,
        );
        const body = object(data) as Partial<CompanionMembershipResponse>;
        return joined(body);
      }),
    read: (callId, memberKey, options) =>
      request(async () => {
        const { data } = await client.get(
          `${BASE}/calls/${encodeURIComponent(callId)}`,
          { ...options, headers: memberHeaders(memberKey) },
        );
        return memberCall(
          (object(data) as Partial<CompanionCallResponse>).call,
        );
      }),
    leave: (callId, memberKey) =>
      request(async () => {
        await client.post(
          `${BASE}/calls/${encodeURIComponent(callId)}/leave`,
          {},
          { headers: memberHeaders(memberKey) },
        );
      }),
    say: (callId, memberKey, said) =>
      request(async () => {
        const { data } = await client.post(
          `${BASE}/calls/${encodeURIComponent(callId)}/phrases`,
          { phrase: said } satisfies CompanionPhraseRequest,
          { headers: memberHeaders(memberKey) },
        );
        return memberCall(
          (object(data) as Partial<CompanionCallResponse>).call,
        );
      }),
    remove: (callId, memberKey, ref) =>
      request(async () => {
        const { data } = await client.post(
          `${BASE}/calls/${encodeURIComponent(callId)}/members/${encodeURIComponent(ref)}/remove`,
          {},
          { headers: memberHeaders(memberKey) },
        );
        return memberCall(
          (object(data) as Partial<CompanionCallResponse>).call,
        );
      }),
    report: (callId, reason, memberKey) =>
      request(async () => {
        const path = `${BASE}/calls/${encodeURIComponent(callId)}/reports`;
        const body = { reason } satisfies CompanionReportRequest;
        if (memberKey)
          await client.post(path, body, { headers: memberHeaders(memberKey) });
        else await student.post(path, body);
      }),
  };
}
