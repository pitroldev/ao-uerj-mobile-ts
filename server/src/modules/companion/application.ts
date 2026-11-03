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
  hidesCall,
  isListed,
  MAX_ALIVE_CALLS,
  memberId,
  memberView,
  newCallId,
  newMemberKey,
  newMemberRef,
  OUTSIDER_PREFIX,
  phraseFits,
  planCall,
  publicView,
  REPORT_RETENTION_MS,
  statSlot,
  STATS_RETENTION_MS,
  WATCH_WINDOW_MS,
  type Call,
  type HourStatKey,
  type ReportReason,
  type ReportSource,
  type StatKey,
} from './domain.ts';
import type {
  CallReportRepository,
  CallRepository,
  Companion,
  CompanionStatsRepository,
  WatcherRepository,
} from './ports.ts';

const notFound = () =>
  new NotFoundError(
    'call_not_found',
    'The call is over, was removed or never existed',
  );

const notMember = () =>
  new ForbiddenError('not_a_member', 'The member key is not in this call');

const removedFromCall = () =>
  new ForbiddenError(
    'removed_from_call',
    'The host removed this member from the call',
  );

/** Quanto a contagem de "de olho agora" fica guardada antes de contar de novo. */
export const WATCHING_CACHE_MS = 30 * 1000;

type Counts = Partial<Record<StatKey | HourStatKey, number>>;

/** Mais um em cada contagem. */
const one = (...keys: (StatKey | HourStatKey)[]): Counts =>
  Object.fromEntries(keys.map(key => [key, 1]));

/**
 * Os casos de uso da Companhia agora. O servidor não sabe quem é ninguém:
 * abrir, entrar e denunciar de fora gastam um token anônimo de aluno (na
 * rota), e cada um recebe uma chave de membro que vale só naquela chamada.
 * Uma pessoa numa chamada não se liga às outras chamadas que ela abriu.
 *
 * Os números do dia (`stats`) são só contagens; uma falha ao gravá-los não
 * atrapalha o pedido de ninguém.
 */
export function createCompanion({
  calls,
  reports,
  stats = null,
  watchers = null,
  watchingCacheMs = WATCHING_CACHE_MS,
  now = systemClock,
}: {
  calls: CallRepository;
  reports: CallReportRepository;
  /** `null`: sem os números (testes antigos, ferramentas). */
  stats?: CompanionStatsRepository | null;
  /** `null`: sem a contagem de "de olho agora". */
  watchers?: WatcherRepository | null;
  watchingCacheMs?: number;
  now?: Clock;
}): Companion {
  const at = () => new Date(now());

  /** Conta no dia de São Paulo; erro ao gravar não sobe. */
  async function bump(counts: Counts, time = at()) {
    if (!stats || !Object.keys(counts).length) return;
    try {
      await stats.add(
        statSlot(time).day,
        counts,
        new Date(time.getTime() + STATS_RETENTION_MS),
      );
    } catch {
      // os números são o de menos: o aluno segue
    }
  }

  let watching: { value: number; at: number } | null = null;
  async function countWatching(time: Date) {
    if (!watchers) return 0;
    if (watching && time.getTime() - watching.at < watchingCacheMs)
      return watching.value;
    const value = await watchers.count(time);
    watching = { value, at: time.getTime() };
    return value;
  }

  /** A chamada que vale e o membro dono da chave. */
  async function membership(callId: string, memberKey: Buffer) {
    const call = await calls.find(callId, at());
    if (!call) throw notFound();
    const id = memberId(memberKey);
    const member = call.members.find(item => item.id === id);
    if (!member)
      throw call.removed.includes(id) ? removedFromCall() : notMember();
    return { call, member };
  }

  /** A primeira vez que a chamada chega a algo (duas pessoas, alguém no ponto). */
  async function firstTime(
    call: Call,
    field: 'filledAt' | 'arrivedAt',
    key: StatKey,
  ) {
    if (call[field]) return;
    try {
      if (await calls.mark(call.id, field, at())) await bump(one(key));
    } catch {
      // idem: é só para os números
    }
  }

  return {
    async list(viewer) {
      const time = at();
      const listed = (await calls.listListed(time)).sort(
        (a, b) => a.at.getTime() - b.at.getTime(),
      );
      let count = 0;
      if (viewer && watchers) {
        try {
          const arrived = await watchers.see(
            viewer,
            time,
            new Date(time.getTime() + WATCH_WINDOW_MS),
          );
          if (arrived) {
            const { hour } = statSlot(time);
            await bump(
              listed.length
                ? one(`lookers_h${hour}`)
                : one(`lookers_h${hour}`, `empty_h${hour}`),
              time,
            );
            // quem acabou de chegar entra na conta já nesta resposta
            if (watching) watching = { ...watching, value: watching.value + 1 };
          }
          count = await countWatching(time);
        } catch {
          // sem a contagem, a lista vem do mesmo jeito
          count = 0;
        }
      }
      return { calls: listed.map(publicView), watching: count };
    },

    async open(request) {
      const time = at();
      if ((await calls.countAlive(time)) >= MAX_ALIVE_CALLS) {
        await bump(one('busy'), time);
        throw new UnavailableError(
          'companion_full',
          'Too many calls are open right now; try again in a few minutes',
        );
      }
      const memberKey = newMemberKey();
      const host = {
        id: memberId(memberKey),
        ref: newMemberRef(),
        name: checkName(request.name),
        host: true,
        joinedAt: time,
      };
      const call = planCall(request, { id: newCallId(), now: time, host });
      await calls.create(call);
      await bump(one(`opened_${call.kind}`), time);
      return { call: memberView(call, host.id), memberKey };
    },

    async join(callId, name) {
      const time = at();
      const memberKey = newMemberKey();
      const member = {
        id: memberId(memberKey),
        ref: newMemberRef(),
        name: checkName(name),
        host: false,
        joinedAt: time,
      };
      const joined = await calls.addMember(callId, member, time);
      if (joined) {
        await bump(
          joined.members.length >= joined.capacity
            ? one('joined', 'full')
            : one('joined'),
          time,
        );
        if (joined.members.length >= 2)
          await firstTime(joined, 'filledAt', `filled_${joined.kind}`);
        return { call: memberView(joined, member.id), memberKey };
      }
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
      if (member.host) {
        await calls.end(call.id, at());
        if (!call.endedAt) await bump(one('ended'));
      } else {
        await calls.removeMember(call.id, member.id);
        await bump(one('left'));
      }
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
      await bump(one(`phrase_${phrase}`));
      // chegou ao ponto com companhia: quem chamou sozinho não conta
      if (phrase === 'at_spot' && updated.members.length >= 2)
        await firstTime(updated, 'arrivedAt', `arrived_${updated.kind}`);
      return memberView(updated, member.id);
    },

    async remove(callId, hostKey, ref) {
      const { call, member } = await membership(callId, hostKey);
      if (!member.host)
        throw new ForbiddenError(
          'not_the_host',
          'Only who opened the call removes someone',
        );
      const target = call.members.find(item => item.ref === ref);
      if (!target)
        throw new NotFoundError(
          'member_not_found',
          'Nobody in this call has that ref',
        );
      if (target.host)
        throw new ConflictError(
          'cannot_remove_host',
          'Who opened the call leaves by ending it',
        );
      await calls.expel(call.id, target.id);
      await bump(one('removed'));
      const updated = await calls.find(call.id, at());
      if (!updated) throw notFound();
      return memberView(updated, member.id);
    },

    async report(callId, reporter, reason) {
      const time = at();
      let reporterId: string;
      let source: ReportSource;
      if ('memberKey' in reporter) {
        const { member } = await membership(callId, reporter.memberKey);
        reporterId = member.id;
        source = member.host ? 'host' : 'member';
      } else {
        if (!(await calls.find(callId, time))) throw notFound();
        // de fora, cada denúncia gasta um token: conta como uma pessoa
        reporterId = `${OUTSIDER_PREFIX}${randomBytes(12).toString('base64url')}`;
        source = 'outsider';
      }
      const counted = await calls.addReporter(callId, reporterId, time);
      // a mesma pessoa já tinha denunciado: nada muda
      if (!counted) return;
      const hides = !counted.hiddenAt && hidesCall(counted, reason, source);
      if (hides) await calls.hide(callId, time);
      await reports.create(
        snapshot(
          counted,
          reason,
          source,
          hides || Boolean(counted.hiddenAt),
          time,
        ),
      );
      await bump(
        hides
          ? one(`reports_${source}`, 'hidden_reports')
          : one(`reports_${source}`),
        time,
      );
    },

    reportsForReview: limit => reports.listRecent(limit),

    async hideByModerator(callId) {
      const time = at();
      const call = await calls.find(callId, time);
      if (!call) return 'gone';
      await calls.hide(callId, time);
      await reports.markHidden(callId);
      await bump(one('hidden_moderation'), time);
      return 'hidden';
    },

    async statsForReview(days) {
      return stats ? stats.listRecent(days) : [];
    },
  };
}

function snapshot(
  call: Call,
  reason: ReportReason,
  source: ReportSource,
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
    source,
    count: call.reporters.length,
    hidden,
    callExpiresAt: call.expiresAt,
    createdAt: time,
    expiresAt: new Date(time.getTime() + REPORT_RETENTION_MS),
  };
}
