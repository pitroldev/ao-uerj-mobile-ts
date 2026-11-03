import { randomBytes } from 'node:crypto';

import { systemClock, type Clock } from '../../shared/clock.ts';
import {
  ConflictError,
  ForbiddenError,
  InvalidInputError,
  NotFoundError,
  UnavailableError,
} from '../../shared/errors.ts';
import {
  checkName,
  COMPANION_LIMITS,
  isListed,
  MAX_ALIVE_CALLS,
  memberId,
  memberView,
  newCallId,
  newMemberKey,
  phraseFits,
  planCall,
  publicView,
  REPORT_RETENTION_MS,
  REPORTS_TO_HIDE,
  type Call,
} from './domain.ts';
import type {
  CallReportRepository,
  CallRepository,
  Companion,
} from './ports.ts';

const notFound = () =>
  new NotFoundError(
    'call_not_found',
    'The call is over, was removed or never existed',
  );

const notMember = () =>
  new ForbiddenError('not_a_member', 'The member key is not in this call');

/**
 * Os casos de uso da Companhia agora. O servidor não sabe quem é ninguém:
 * abrir, entrar e denunciar de fora gastam um token anônimo de aluno (na
 * rota), e cada um recebe uma chave de membro que vale só naquela chamada.
 * Uma pessoa numa chamada não se liga às outras chamadas que ela abriu.
 */
export function createCompanion({
  calls,
  reports,
  now = systemClock,
}: {
  calls: CallRepository;
  reports: CallReportRepository;
  now?: Clock;
}): Companion {
  const at = () => new Date(now());

  /** A chamada que vale e o membro dono da chave. */
  async function membership(callId: string, memberKey: Buffer) {
    const call = await calls.find(callId, at());
    if (!call) throw notFound();
    const id = memberId(memberKey);
    const member = call.members.find(item => item.id === id);
    if (!member) throw notMember();
    return { call, member };
  }

  return {
    async list() {
      const listed = await calls.listListed(at());
      return listed
        .sort((a, b) => a.at.getTime() - b.at.getTime())
        .map(publicView);
    },

    async open(request) {
      const time = at();
      if ((await calls.countAlive(time)) >= MAX_ALIVE_CALLS)
        throw new UnavailableError(
          'companion_full',
          'Too many calls are open right now; try again in a few minutes',
        );
      const memberKey = newMemberKey();
      const host = {
        id: memberId(memberKey),
        name: checkName(request.name),
        host: true,
        joinedAt: time,
      };
      const call = planCall(request, { id: newCallId(), now: time, host });
      await calls.create(call);
      return { call: memberView(call, host.id), memberKey };
    },

    async join(callId, name) {
      const time = at();
      const memberKey = newMemberKey();
      const member = {
        id: memberId(memberKey),
        name: checkName(name),
        host: false,
        joinedAt: time,
      };
      const joined = await calls.addMember(callId, member, time);
      if (joined) return { call: memberView(joined, member.id), memberKey };
      // não entrou: diz por quê
      const call = await calls.find(callId, time);
      if (!call) throw notFound();
      if (!isListed(call, time))
        throw new ConflictError(
          'call_closed',
          'The call already left or was ended',
        );
      throw new ConflictError('call_full', 'The call has no room left');
    },

    async read(callId, memberKey) {
      const { call, member } = await membership(callId, memberKey);
      return memberView(call, member.id);
    },

    async leave(callId, memberKey) {
      const { call, member } = await membership(callId, memberKey);
      if (member.host) await calls.end(call.id, at());
      else await calls.removeMember(call.id, member.id);
    },

    async say(callId, memberKey, phrase) {
      const { call, member } = await membership(callId, memberKey);
      if (!phraseFits(phrase, call.kind))
        throw new InvalidInputError(`phrase ${phrase} is not for ${call.kind}`);
      if (call.endedAt)
        throw new ConflictError('call_ended', 'The call was ended');
      const updated = await calls.addFeed(
        call.id,
        { member: member.id, name: member.name, phrase, at: at() },
        COMPANION_LIMITS.feed,
        at(),
      );
      if (!updated) throw notFound();
      return memberView(updated, member.id);
    },

    async report(callId, reporter, reason) {
      const time = at();
      let reporterId: string;
      if ('memberKey' in reporter) {
        reporterId = (await membership(callId, reporter.memberKey)).member.id;
      } else {
        if (!(await calls.find(callId, time))) throw notFound();
        // de fora, cada denúncia gasta um token: conta como uma pessoa
        reporterId = `outsider:${randomBytes(12).toString('base64url')}`;
      }
      const counted = await calls.addReporter(callId, reporterId, time);
      // a mesma pessoa já tinha denunciado: nada muda
      if (!counted) return;
      const hidden = counted.reporters.length >= REPORTS_TO_HIDE;
      if (hidden && !counted.hiddenAt) await calls.hide(callId, time);
      await reports.create(snapshot(counted, reason, hidden, time));
    },

    reportsForReview: limit => reports.listRecent(limit),
  };
}

function snapshot(
  call: Call,
  reason: Parameters<Companion['report']>[2],
  hidden: boolean,
  time: Date,
) {
  return {
    callId: call.id,
    kind: call.kind,
    at: call.at,
    spot: call.spot,
    destination: call.destination,
    note: call.note,
    names: call.members.map(member => member.name),
    reason,
    count: call.reporters.length,
    hidden,
    createdAt: time,
    expiresAt: new Date(time.getTime() + REPORT_RETENTION_MS),
  };
}
