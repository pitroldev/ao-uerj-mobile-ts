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
  CALL_WATCH_SEEN_LIMIT,
  callForWatch,
  checkName,
  checkWatchWindow,
  COMPANION_LIMITS,
  hidesCall,
  isListed,
  listedView,
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
  removedStudent,
  REPORT_RETENTION_MS,
  statSlot,
  STATS_RETENTION_MS,
  WATCH_WINDOW_MS,
  watchMessage,
  type Call,
  type CallWatch,
  type HourStatKey,
  type ReportReason,
  type ReportSource,
  type StatKey,
} from './domain.ts';
import type {
  CallReportRepository,
  CallRepository,
  CallWatchRepository,
  Companion,
  CompanionStatsRepository,
  PushMessage,
  PushResult,
  PushSender,
  WatcherRepository,
} from './ports.ts';
import type { StudentActor } from '../students/ports.ts';

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

const sessionRequired = () =>
  new ForbiddenError(
    'session_required',
    'This membership belongs to a student: send the student session',
  );

/** Quanto a contagem de "de olho agora" fica guardada antes de contar de novo. */
export const WATCHING_CACHE_MS = 30 * 1000;

const pushUnavailable = () =>
  new UnavailableError(
    'push_unavailable',
    'Notifications to the iPhone are not available right now',
  );

/** O aviso da chamada no aparelho: até ela sair da lista, depois não serve. */
const watchPush = (call: Call): PushMessage => ({
  ...watchMessage(call),
  thread: 'companion',
  collapseId: 'companion-watch',
  target: 'companion',
  expiresAt: call.listedUntil,
});

type Counts = Partial<Record<StatKey | HourStatKey, number>>;

/** Mais um em cada contagem. */
const one = (...keys: (StatKey | HourStatKey)[]): Counts =>
  Object.fromEntries(keys.map(key => [key, 1]));

/**
 * Os casos de uso da Companhia agora. Cada um recebe uma chave de membro que
 * vale só naquela chamada. Com a sessão (`actor`), o membro guarda também o
 * aluno: a moderação sabe quem estava, uma pessoa abre uma chamada por vez
 * e entra uma vez em cada uma, e quem foi tirado não volta. Os apps antigos
 * entram com o token anônimo e ficam sem aluno.
 *
 * Os números do dia (`stats`) são só contagens; uma falha ao gravá-los não
 * atrapalha o pedido de ninguém.
 *
 * O "Me avise se abrirem" (`watches` e `push`) manda um push para o iPhone
 * de quem pediu quando aparece na lista uma chamada que serve. O envio não
 * segura quem abriu, e a falha dele vai só para `onPushError`.
 */
export function createCompanion({
  calls,
  reports,
  stats = null,
  watchers = null,
  watches = null,
  push = null,
  onPushError = () => undefined,
  watchingCacheMs = WATCHING_CACHE_MS,
  now = systemClock,
}: {
  calls: CallRepository;
  reports: CallReportRepository;
  /** `null`: sem os números (testes antigos, ferramentas). */
  stats?: CompanionStatsRepository | null;
  /** `null`: sem a contagem de "de olho agora". */
  watchers?: WatcherRepository | null;
  /** `null` (ou sem `push`): sem o "Me avise se abrirem" pelo servidor. */
  watches?: CallWatchRepository | null;
  /** `null`: sem a chave do APNs, o push fica desligado. */
  push?: PushSender | null;
  onPushError?: (err: unknown) => void;
  watchingCacheMs?: number;
  now?: Clock;
}): Companion {
  const at = () => new Date(now());
  const alerts = watches && push ? { watches, push } : null;

  /** Manda o aviso e diz se chegou; erro do envio não sobe. */
  async function sendWatch(watch: CallWatch, call: Call) {
    if (!alerts) return false;
    let result: PushResult;
    try {
      result = await alerts.push.send(watch.device, watchPush(call));
    } catch (err) {
      onPushError(err);
      result = 'failed';
    }
    // não chegou agora: o pedido volta, e a próxima rodada tenta de novo (o
    // aviso repetido fica no lugar do anterior, pelo `collapseId`). O token
    // que a Apple recusou de vez vai embora com o pedido
    if (result === 'failed')
      await alerts.watches.restore(watch).catch(onPushError);
    return result === 'sent';
  }

  async function deliverWatches() {
    if (!alerts) return 0;
    const time = at();
    const pending = await alerts.watches.listActive(time);
    if (!pending.length) return 0;
    const listed = await calls.listListed(time);
    let sent = 0;
    for (const watch of pending) {
      const call = callForWatch(watch, listed);
      // um aviso por pedido: quem leva o pedido primeiro manda
      if (!call || !(await alerts.watches.claim(watch))) continue;
      if (await sendWatch(watch, call)) sent++;
    }
    return sent;
  }

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

  /**
   * A chamada que vale e o membro dono da chave. A participação de um aluno
   * só vale com a sessão dele: a chave sozinha (copiada, por exemplo) não.
   */
  async function membership(
    callId: string,
    memberKey: Buffer,
    actor: StudentActor | null | undefined,
  ) {
    const call = await calls.find(callId, at());
    if (!call) throw notFound();
    const id = memberId(memberKey);
    const member = call.members.find(item => item.id === id);
    if (!member)
      throw call.removed.includes(id) ? removedFromCall() : notMember();
    if (member.student) {
      if (!actor) throw sessionRequired();
      if (actor.studentId !== member.student) throw notMember();
    }
    return { call, member };
  }

  /** As chamadas que valem e que o aluno abriu (e ainda não acabaram). */
  async function hostedBy(studentId: string, time: Date) {
    return (await calls.listAliveWith(studentId, time)).filter(
      call =>
        !call.endedAt &&
        call.members.some(item => item.host && item.student === studentId),
    );
  }

  /**
   * Fica só a chamada mais nova que o aluno abriu; as outras acabam. Todo
   * pedido escolhe a mesma (pela hora em que abriu e, no empate, pelo id),
   * então duas aberturas ao mesmo tempo não deixam duas no ar. Devolve o id
   * da que ficou.
   */
  async function keepNewestHosted(studentId: string, time: Date) {
    const openedAt = (call: Call) =>
      call.members.find(item => item.host)?.joinedAt.getTime() ?? 0;
    const hosted = (await hostedBy(studentId, time)).sort(
      (a, b) => openedAt(a) - openedAt(b) || a.id.localeCompare(b.id),
    );
    const newest = hosted.pop();
    for (const older of hosted) {
      await calls.end(older.id, time);
      await bump(one('ended'), time);
    }
    return newest?.id ?? null;
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

    async open(request, actor) {
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
        student: actor?.studentId ?? null,
      };
      const call = planCall(request, { id: newCallId(), now: time, host });
      await calls.create(call);
      await bump(one(`opened_${call.kind}`), time);
      // uma chamada aberta por aluno: fica a mais nova, e as outras acabam.
      // Duas aberturas juntas chegam à mesma conta, e só uma fica
      let current = call;
      if (actor && (await keepNewestHosted(actor.studentId, time)) !== call.id)
        current = (await calls.find(call.id, time)) ?? call;
      // quem pediu o aviso fica sabendo agora, sem segurar quem abriu
      if (alerts) void deliverWatches().catch(onPushError);
      return { call: memberView(current, host.id), memberKey };
    },

    async join(callId, name, actor) {
      const time = at();
      const memberKey = newMemberKey();
      const member = {
        id: memberId(memberKey),
        ref: newMemberRef(),
        name: checkName(name),
        host: false,
        joinedAt: time,
        student: actor?.studentId ?? null,
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
      if (actor) {
        if (call.removed.includes(removedStudent(actor.studentId)))
          throw removedFromCall();
        if (call.members.some(item => item.student === actor.studentId))
          throw new ConflictError(
            'already_member',
            'This student is already in the call',
          );
      }
      if (!isListed(call, time))
        throw new ConflictError(
          'call_closed',
          'The call already left or was ended',
        );
      throw new ConflictError('call_full', 'The call has no room left');
    },

    async read(callId, memberKey, actor) {
      const { call, member } = await membership(callId, memberKey, actor);
      return memberView(call, member.id);
    },

    async leave(callId, memberKey, actor) {
      const { call, member } = await membership(callId, memberKey, actor);
      if (member.host) {
        await calls.end(call.id, at());
        if (!call.endedAt) await bump(one('ended'));
      } else {
        await calls.removeMember(call.id, member.id);
        await bump(one('left'));
      }
    },

    async say(callId, memberKey, phrase, actor) {
      const { call, member } = await membership(callId, memberKey, actor);
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

    async remove(callId, hostKey, ref, actor) {
      const { call, member } = await membership(callId, hostKey, actor);
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
      // o aluno tirado não volta nem por outro aparelho
      if (target.student)
        await calls.expel(call.id, removedStudent(target.student));
      await bump(one('removed'));
      const updated = await calls.find(call.id, at());
      if (!updated) throw notFound();
      return memberView(updated, member.id);
    },

    async report(callId, reporter, reason, actor) {
      const time = at();
      let reporterId: string;
      let source: ReportSource;
      if ('memberKey' in reporter) {
        const { member } = await membership(callId, reporter.memberKey, actor);
        reporterId = member.id;
        source = member.host ? 'host' : 'member';
      } else {
        if (!(await calls.find(callId, time))) throw notFound();
        // de fora: com a sessão, uma denúncia por aluno; com o token dos
        // apps antigos, cada uma gasta um token e conta como uma pessoa
        reporterId = actor
          ? `${OUTSIDER_PREFIX}${removedStudent(actor.studentId)}`
          : `${OUTSIDER_PREFIX}${randomBytes(12).toString('base64url')}`;
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
          actor?.studentId ?? null,
        ),
      );
      await bump(
        hides
          ? one(`reports_${source}`, 'hidden_reports')
          : one(`reports_${source}`),
        time,
      );
    },

    async dropStudent(studentId) {
      const time = at();
      await watches?.remove(studentId);
      for (const call of await calls.listAliveWith(studentId, time)) {
        if (call.endedAt) continue;
        const mine = call.members.filter(item => item.student === studentId);
        if (mine.some(item => item.host)) {
          await calls.end(call.id, time);
          await bump(one('ended'), time);
        } else
          for (const member of mine)
            await calls.removeMember(call.id, member.id);
      }
    },

    reportsForReview: limit => reports.listRecent(limit),

    async hideByModerator(callId) {
      const time = at();
      const call = await calls.find(callId, time);
      if (!call) return 'gone';
      await calls.hide(callId, time);
      await reports.markHidden(callId, 'moderation');
      await bump(one('hidden_moderation'), time);
      return 'hidden';
    },

    async keepByModerator(callId) {
      const time = at();
      await reports.markReviewed(callId, time);
      return (await calls.find(callId, time)) ? 'kept' : 'gone';
    },

    reopenReview: callId => reports.markReviewed(callId, null),

    async listedForReview() {
      const listed = await calls.listListed(at());
      return listed
        .sort((a, b) => a.at.getTime() - b.at.getTime())
        .map(listedView);
    },

    async statsForReview(days) {
      return stats ? stats.listRecent(days) : [];
    },

    async watchStatus(actor) {
      const watch = await watches?.find(actor.studentId, at());
      return {
        available: Boolean(alerts),
        watch: watch ? { kind: watch.kind, until: watch.until } : null,
      };
    },

    async watch(actor, request) {
      if (!alerts) throw pushUnavailable();
      const time = at();
      checkWatchWindow(request.until, time);
      const watch: CallWatch = {
        student: actor.studentId,
        kind: request.kind,
        until: request.until,
        seen: [...new Set(request.seen)].slice(0, CALL_WATCH_SEEN_LIMIT),
        device: {
          platform: request.device.platform,
          token: request.device.token,
        },
        createdAt: time,
      };
      await alerts.watches.put(watch);
      return { kind: watch.kind, until: watch.until };
    },

    async unwatch(actor) {
      await watches?.remove(actor.studentId);
    },

    deliverWatches,
  };
}

function snapshot(
  call: Call,
  reason: ReportReason,
  source: ReportSource,
  hidden: boolean,
  time: Date,
  reporterStudent: string | null,
) {
  return {
    callId: call.id,
    kind: call.kind,
    at: call.at,
    spot: call.spot,
    destination: call.destination,
    note: call.note,
    names: call.members.map(member => member.name),
    people: call.members.map(member => ({
      name: member.name,
      host: member.host,
      student: member.student,
    })),
    reporterStudent,
    reason,
    source,
    count: call.reporters.length,
    hidden,
    hiddenBy: hidden ? ('reports' as const) : null,
    reviewedAt: null,
    callExpiresAt: call.expiresAt,
    createdAt: time,
    expiresAt: new Date(time.getTime() + REPORT_RETENTION_MS),
  };
}
