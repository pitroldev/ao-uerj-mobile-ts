import { systemClock, type Clock } from '../../shared/clock.ts';
import {
  ConflictError,
  ForbiddenError,
  InvalidInputError,
  LimitError,
  NotFoundError,
  UnavailableError,
} from '../../shared/errors.ts';
import type { StudentActor } from '../students/ports.ts';
import {
  ANSWER_RETENTION_MS,
  checkNotice,
  DAILY_NOTICE_LIMIT,
  DAY_RETENTION_MS,
  earlier,
  emptyContributor,
  ENDS_TO_CLOSE,
  extendedExpiry,
  FLAGS_TO_REMOVE,
  isActive,
  MAX_ACTIVE_NOTICES,
  monthOf,
  monthRange,
  monthSummary,
  newNoticeId,
  noticeView,
  placeKey,
  planNotice,
  POINTS,
  POINTS_ANSWERS_PER_DAY,
  POINTS_NOTICES_PER_DAY,
  previousMonth,
  saoPaulo,
  SEEN_LIMIT,
  standing,
  startOfDay,
  weekdaysOf,
  weekStart,
  weekSummary,
  type Answer,
  type Contributor,
  type DayField,
  type Notice,
} from './domain.ts';
import type {
  AnswerRepository,
  CampusNow,
  Community,
  ContributorRepository,
  DayRepository,
  Earned,
  NoticeRepository,
  ReportResult,
} from './ports.ts';

/** A lista que vale para todos fica guardada por poucos segundos. */
export const LIST_CACHE_MS = 5 * 1000;
/** "Quantos ajudaram hoje" muda devagar: um minuto. */
export const HELPERS_CACHE_MS = 60 * 1000;
/** O campus somado: dez minutos. */
export const COMMUNITY_CACHE_MS = 10 * 60 * 1000;
/** A moderação olha os denunciados dos últimos 7 dias. */
export const FLAGGED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Quantos avisos cada parte da página da moderação mostra. */
const MODERATION_PAGE = 100;
const RECENT_PAGE = 50;

const notFound = () =>
  new NotFoundError(
    'notice_not_found',
    'The notice is over, was removed or never existed',
  );

const ownNotice = () =>
  new ForbiddenError(
    'own_notice',
    'Students do not confirm, thank or flag their own notice',
  );

const alreadyAnswered = () =>
  new ConflictError(
    'already_answered',
    'This student already answered this notice',
  );

/** Até quando a resposta de um aluno a um aviso fica no banco. */
const purgeOf = (notice: Notice) =>
  new Date(notice.createdAt.getTime() + ANSWER_RETENTION_MS);

const earnedOf = (contributor: Contributor | null, earned: number): Earned => ({
  ...standing(contributor?.points ?? 0),
  earned,
});

/**
 * Os casos de uso de Agora no campus. Todo pedido vem de um aluno
 * identificado (a sessão): é por ele que cada um responde uma vez a cada
 * aviso, que os pontos somam e que o limite do dia vale. Os outros alunos
 * nunca veem quem avisou.
 *
 * Para muitos alunos ao mesmo tempo, a lista que vale para todos fica
 * guardada por poucos segundos (e é refeita a cada gravação deste processo);
 * o que é de cada um (o que respondeu) vem numa consulta só, pelos ids.
 */
export function createCampusNow({
  notices,
  answers,
  contributors,
  days,
  now = systemClock,
  listCacheMs = LIST_CACHE_MS,
  helpersCacheMs = HELPERS_CACHE_MS,
  communityCacheMs = COMMUNITY_CACHE_MS,
}: {
  notices: NoticeRepository;
  answers: AnswerRepository;
  contributors: ContributorRepository;
  days: DayRepository;
  now?: Clock;
  listCacheMs?: number;
  helpersCacheMs?: number;
  communityCacheMs?: number;
}): CampusNow {
  const at = () => new Date(now());

  let cached: { value: Promise<Notice[]>; at: number } | null = null;
  /** Os que valem, da lista guardada (a falha não fica guardada). */
  function activeNotices(time: Date) {
    if (cached && time.getTime() - cached.at < listCacheMs) return cached.value;
    const entry = { value: notices.listActive(time), at: time.getTime() };
    cached = entry;
    entry.value.catch(() => {
      if (cached === entry) cached = null;
    });
    return entry.value;
  }
  /** Uma gravação mudou a lista: a próxima leitura vai ao banco. */
  const changed = () => {
    cached = null;
  };

  let helpers: { day: string; value: number; at: number } | null = null;
  async function helpersToday(time: Date) {
    const { day } = saoPaulo(time);
    if (
      helpers &&
      helpers.day === day &&
      time.getTime() - helpers.at < helpersCacheMs
    )
      return helpers.value;
    const value = await days.countDay(day);
    helpers = { day, value, at: time.getTime() };
    return value;
  }

  const communities = new Map<
    string,
    { value: Promise<Community>; at: number }
  >();

  /** Mais um (ou menos um) na contagem do dia do aluno. */
  const dayAdd = (
    student: string,
    field: DayField,
    amount: number,
    time: Date,
  ) =>
    days.add(
      student,
      saoPaulo(time).day,
      field,
      amount,
      new Date(time.getTime() + DAY_RETENTION_MS),
    );

  /** O aviso que vale agora; senão, 404. */
  async function activeNotice(id: string, time: Date) {
    const notice = await notices.find(id);
    if (!notice || !isActive(notice, time)) throw notFound();
    return notice;
  }

  /** O que o aluno fez com o aviso (para a resposta), lido de novo. */
  async function answerOf(notice: string, student: string) {
    const [answer] = await answers.forStudent(student, [notice]);
    return answer ?? null;
  }

  /**
   * Os pontos da primeira resposta de um aviso (dentro do limite do dia) e a
   * contagem de respostas de sempre.
   */
  async function answerPoints(student: string, time: Date) {
    const counts = await dayAdd(student, 'answers', 1, time);
    const earned = counts.answers <= POINTS_ANSWERS_PER_DAY ? POINTS.answer : 0;
    const contributor = await contributors.add(student, {
      points: earned,
      answers: 1,
    });
    return earnedOf(contributor, earned);
  }

  /** Quem avisou perde os pontos de aviso tirado do ar, uma vez só. */
  async function penalize(notice: Notice) {
    if (await notices.setPenalized(notice.id, true))
      await contributors.add(notice.reporter, { points: POINTS.removed });
  }

  /**
   * "Continua" de outro aluno: empurra o fim e, na primeira confirmação,
   * dá os pontos de quem avisou. `null` se o aluno já tinha respondido.
   */
  async function confirm(notice: Notice, student: string, time: Date) {
    const recorded = await answers.answer(
      notice.id,
      student,
      'confirm',
      purgeOf(notice),
    );
    if (!recorded) return null;
    let updated =
      (await notices.addConfirmation(
        notice.id,
        extendedExpiry(notice, time),
      )) ?? notice;
    if (
      !updated.firstConfirmedAt &&
      (await notices.markFirstConfirmed(notice.id, time))
    ) {
      await contributors.add(notice.reporter, {
        points: POINTS.confirmed,
        confirmedNotices: 1,
      });
      updated = { ...updated, firstConfirmedAt: time };
    }
    const you = await answerPoints(student, time);
    changed();
    return { notice: updated, you };
  }

  /** O pedido igual a um aviso que já vale vira a confirmação dele. */
  async function mergeInto(
    notice: Notice,
    student: string,
    time: Date,
  ): Promise<ReportResult> {
    const confirmed =
      notice.reporter === student ? null : await confirm(notice, student, time);
    const current = confirmed?.notice ?? notice;
    const you = confirmed?.you ?? earnedOf(await contributors.find(student), 0);
    return {
      notice: noticeView(
        current,
        student,
        await answerOf(current.id, student),
        time,
      ),
      merged: true,
      replaced: null,
      you,
    };
  }

  async function buildCommunity(month: string, time: Date): Promise<Community> {
    const from = weekStart(time);
    const range = monthRange(month);
    const [week, inMonth] = await Promise.all([
      notices.listCreated(startOfDay(from), time),
      notices.listCreated(
        range.from,
        new Date(Math.min(range.to.getTime(), time.getTime())),
      ),
    ]);
    return {
      week: { from, ...weekSummary(week) },
      month: {
        month,
        weekdays: weekdaysOf(month, time),
        ...monthSummary(inMonth),
      },
    };
  }

  function community(month: string | null) {
    const time = at();
    const current = monthOf(time);
    const wanted = month ?? current;
    if (wanted !== current && wanted !== previousMonth(current))
      throw new InvalidInputError(
        'month must be the current month or the previous one',
      );
    const entry = communities.get(wanted);
    if (entry && time.getTime() - entry.at < communityCacheMs)
      return entry.value;
    const fresh = { value: buildCommunity(wanted, time), at: time.getTime() };
    communities.set(wanted, fresh);
    fresh.value.catch(() => {
      if (communities.get(wanted) === fresh) communities.delete(wanted);
    });
    return fresh.value;
  }

  return {
    async list({ studentId }: StudentActor) {
      const time = at();
      const [all, contributor, helped] = await Promise.all([
        activeNotices(time),
        contributors.find(studentId),
        helpersToday(time),
      ]);
      const live = all
        .filter(notice => isActive(notice, time))
        .sort((a, b) => earlier(b, a));
      const mine = await answers.forStudent(
        studentId,
        live.map(notice => notice.id),
      );
      const byNotice = new Map<string, Answer>(
        mine.map(answer => [answer.notice, answer]),
      );
      return {
        notices: live.map(notice =>
          noticeView(notice, studentId, byNotice.get(notice.id), time),
        ),
        helpersToday: helped,
        you: standing(contributor?.points ?? 0),
      };
    },

    async report(request, { studentId }) {
      const time = at();
      const checked = checkNotice(request);
      const key = placeKey(checked.place);
      const same = await notices.listActiveAt(checked.kind, key, time);
      const identical = same
        .filter(notice => notice.status === checked.status)
        .sort(earlier)[0];
      if (identical) return mergeInto(identical, studentId, time);

      if ((await notices.countActive(time)) >= MAX_ACTIVE_NOTICES)
        throw new UnavailableError(
          'campus_full',
          'Too many notices are active right now; try again in a few minutes',
        );
      const counts = await dayAdd(studentId, 'notices', 1, time);
      if (counts.notices > DAILY_NOTICE_LIMIT) {
        await dayAdd(studentId, 'notices', -1, time);
        throw new LimitError(
          'notice_limit_reached',
          `A student posts at most ${DAILY_NOTICE_LIMIT} notices a day`,
        );
      }
      const before = await contributors.find(studentId);
      const notice = planNotice(checked, {
        id: newNoticeId(),
        reporter: studentId,
        level: standing(before?.points ?? 0).level,
        now: time,
      });
      await notices.create(notice);
      changed();

      // duas pessoas avisaram o mesmo ao mesmo tempo: fica o primeiro, e
      // este vira a confirmação dele (os dois pedidos chegam à mesma conta)
      const twin = (await notices.listActiveAt(checked.kind, key, time))
        .filter(
          other =>
            other.id !== notice.id &&
            other.status === checked.status &&
            earlier(other, notice) < 0,
        )
        .sort(earlier)[0];
      if (twin) {
        await notices.end(notice.id, time, 'replaced');
        await dayAdd(studentId, 'notices', -1, time);
        return mergeInto(twin, studentId, time);
      }

      // outra situação no mesmo lugar (a fila que cresceu): a anterior
      // acabou. Só as de antes deste, para dois pedidos juntos não se
      // encerrarem um ao outro
      let replaced: string | null = null;
      const older = same
        .filter(
          other =>
            other.status !== checked.status && earlier(other, notice) < 0,
        )
        .sort((a, b) => earlier(b, a));
      for (const other of older)
        if (await notices.end(other.id, time, 'replaced'))
          replaced ??= other.id;

      const earned =
        counts.notices <= POINTS_NOTICES_PER_DAY ? POINTS.notice : 0;
      const contributor = await contributors.add(studentId, {
        points: earned,
        notices: 1,
      });
      return {
        notice: noticeView(notice, studentId, null, time),
        merged: false,
        replaced,
        you: earnedOf(contributor, earned),
      };
    },

    async answer(id, value, { studentId }) {
      const time = at();
      const notice = await activeNotice(id, time);
      if (notice.reporter === studentId) {
        if (value === 'confirm') throw ownNotice();
        // "Já resolveu": o "Acabou" de quem avisou encerra na hora
        await notices.end(id, time, 'reporter');
        changed();
        return {
          notice: noticeView(
            { ...notice, endedAt: time, endedBy: 'reporter' },
            studentId,
            null,
            time,
          ),
          you: earnedOf(await contributors.find(studentId), 0),
        };
      }
      if (value === 'confirm') {
        const confirmed = await confirm(notice, studentId, time);
        if (!confirmed) throw alreadyAnswered();
        return {
          notice: noticeView(
            confirmed.notice,
            studentId,
            await answerOf(id, studentId),
            time,
          ),
          you: confirmed.you,
        };
      }
      const recorded = await answers.answer(
        id,
        studentId,
        'end',
        purgeOf(notice),
      );
      if (!recorded) throw alreadyAnswered();
      let updated = (await notices.addEnd(id)) ?? notice;
      if (
        updated.ends >= ENDS_TO_CLOSE &&
        !updated.endedAt &&
        (await notices.end(id, time, 'answers'))
      )
        updated = { ...updated, endedAt: time, endedBy: 'answers' };
      changed();
      // de "Continua" para "Acabou" não dá pontos de novo
      const you =
        recorded.previous === null
          ? await answerPoints(studentId, time)
          : earnedOf(await contributors.find(studentId), 0);
      return {
        notice: noticeView(
          updated,
          studentId,
          await answerOf(id, studentId),
          time,
        ),
        you,
      };
    },

    async thank(id, { studentId }) {
      const time = at();
      const notice = await activeNotice(id, time);
      if (notice.reporter === studentId) throw ownNotice();
      let updated = notice;
      if (await answers.mark(id, studentId, 'thanked', purgeOf(notice))) {
        updated = (await notices.addThanks(id)) ?? notice;
        await contributors.add(notice.reporter, {
          points: POINTS.thanks,
          thanksReceived: 1,
        });
        await dayAdd(studentId, 'thanks', 1, time);
        changed();
      }
      return {
        notice: noticeView(
          updated,
          studentId,
          await answerOf(id, studentId),
          time,
        ),
        you: earnedOf(await contributors.find(studentId), 0),
      };
    },

    async flag(id, { studentId }) {
      const time = at();
      const notice = await activeNotice(id, time);
      if (notice.reporter === studentId) throw ownNotice();
      if (!(await answers.mark(id, studentId, 'flagged', purgeOf(notice))))
        return;
      const updated = await notices.addFlag(id);
      // três alunos dizem que não é verdade: sai do ar, e quem avisou perde
      // os pontos. Um aviso que a moderação manteve não sai mais assim
      if (
        updated &&
        updated.flags >= FLAGS_TO_REMOVE &&
        !updated.reviewedAt &&
        !updated.removedAt &&
        (await notices.remove(id, time, 'flags'))
      )
        await penalize(updated);
      changed();
    },

    async seen(ids, { studentId }) {
      const unique = [...new Set(ids)].slice(0, SEEN_LIMIT);
      if (!unique.length) return;
      const found = (await notices.findMany(unique)).filter(
        notice => notice.reporter !== studentId,
      );
      if (!found.length) return;
      const fresh = await answers.see(
        found.map(notice => ({ id: notice.id, purgeAt: purgeOf(notice) })),
        studentId,
      );
      if (!fresh.length) return;
      await notices.addViews(fresh);
      // "quantos viram" de cada um que avisou; a lista guardada não muda
      // por isso (só quem avisou vê o número)
      const byReporter = new Map<string, number>();
      for (const notice of found)
        if (fresh.includes(notice.id))
          byReporter.set(
            notice.reporter,
            (byReporter.get(notice.reporter) ?? 0) + 1,
          );
      for (const [reporter, views] of byReporter)
        await contributors.add(reporter, { viewsReceived: views });
    },

    async you({ studentId }) {
      const time = at();
      const today = saoPaulo(time).day;
      const [contributor, mine] = await Promise.all([
        contributors.find(studentId),
        notices.listByReporter(studentId, startOfDay(weekStart(time))),
      ]);
      const counted = mine.filter(notice => !notice.removedAt);
      const all = contributor ?? emptyContributor(studentId);
      return {
        you: standing(all.points),
        counts: {
          notices: all.notices,
          answers: all.answers,
          confirmedNotices: all.confirmedNotices,
          thanksReceived: all.thanksReceived,
          viewsReceived: all.viewsReceived,
        },
        week: {
          notices: counted.length,
          views: counted.reduce((sum, notice) => sum + notice.views, 0),
          thanks: counted.reduce((sum, notice) => sum + notice.thanks, 0),
        },
        today: mine
          .filter(notice => saoPaulo(notice.createdAt).day === today)
          .sort((a, b) => earlier(b, a))
          .map(notice => noticeView(notice, studentId, null, time)),
      };
    },

    community: async month => community(month),

    async dropStudent(studentId) {
      const time = at();
      for (const notice of await notices.listActiveBy(studentId, time))
        await notices.remove(notice.id, time, 'ban');
      changed();
    },

    async moderation() {
      const time = at();
      const since = new Date(time.getTime() - FLAGGED_WINDOW_MS);
      const [flagged, recent, active, numbers] = await Promise.all([
        notices.listFlagged(since, MODERATION_PAGE),
        notices.listRecent(RECENT_PAGE + MODERATION_PAGE),
        notices.countActive(time),
        community(null),
      ]);
      const shown = new Set(flagged.map(notice => notice.id));
      return {
        flagged,
        recent: recent
          .filter(notice => !shown.has(notice.id))
          .slice(0, RECENT_PAGE),
        active,
        week: numbers.week,
      };
    },

    pendingFlags: () =>
      notices.countPendingFlags(new Date(now() - FLAGGED_WINDOW_MS)),

    async removeByModerator(id) {
      const time = at();
      const notice = await notices.find(id);
      if (!notice) return 'gone';
      if (!notice.removedAt) await notices.remove(id, time, 'moderation');
      // o banido já saiu do ar, sem perder pontos por isso
      if (notice.removedBy !== 'ban') await penalize(notice);
      await notices.markReviewed(id, time);
      changed();
      return 'removed';
    },

    async restoreByModerator(id) {
      const time = at();
      const notice = await notices.find(id);
      if (!notice || notice.removedBy === 'ban') return 'gone';
      if (notice.removedAt) await notices.restore(id, time);
      // devolve os pontos que as denúncias (ou a moderação) tiraram
      if (await notices.setPenalized(id, false))
        await contributors.add(notice.reporter, { points: -POINTS.removed });
      await notices.markReviewed(id, time);
      changed();
      return 'restored';
    },
  };
}
