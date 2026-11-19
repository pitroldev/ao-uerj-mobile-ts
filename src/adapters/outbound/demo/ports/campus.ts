import { AppError } from '@root/shared/errors/AppError';
import {
  CampusNowError,
  ENDS_TO_CLOSE,
  floorsOf,
  monthOf,
  NOTICE_BLOCKS,
  NOTICE_GATES,
  placeKey,
  placeTypeOf,
  previousMonth,
  STATUSES_BY_KIND,
  type CampusNotice,
  type CommunitySummary,
  type Earned,
  type NoticeAnswer,
  type NoticeKind,
  type NoticePlace,
  type NoticeRequest,
  type NoticeResult,
  type NoticeState,
  type NoticeStatus,
  type Standing,
  type YouSummary,
} from '@root/modules/campus-now/domain/campusNow';
import type {
  CampusNowServerPort,
  CampusPushServerPort,
} from '@root/modules/campus-now/application/ports';
import type { DemoClock } from '../clock';
import {
  DEMO_CAMPUS_WEEK,
  DEMO_CONTRIBUTOR,
  DEMO_HELPERS_TODAY,
  DEMO_NOTICE_SEEDS,
  DEMO_PROBLEMS,
  DEMO_WEEK,
  type DemoNoticeSeed,
} from '../data/campus';

/*
 * O Agora no campus da demo: as regras do servidor
 * (server/src/modules/campus-now), na memória e simplificadas. O aluno da
 * demo é o único que age; os avisos dele ganham, com o tempo, quem viu, uma
 * confirmação e um "Valeu" de alunos inventados, para a aba Você mostrar o
 * que o app mostra de verdade.
 */

const MINUTE = 60 * 1000;

/** Quanto cada situação vale, em minutos (STATUSES do servidor). */
const MINUTES: Record<NoticeKind, Partial<Record<NoticeStatus, number>>> = {
  elevators: { short_queue: 45, long_queue: 60, stopped: 180 },
  ru: { short_queue: 30, long_queue: 30, closed: 120 },
  power: { no_power: 120, no_ac: 120, no_outlets: 120 },
  internet: { wifi_down: 120, wifi_slow: 120 },
  restroom: { no_water: 120, closed: 180, no_paper: 120 },
  access: { gate_closed: 360, ramp_closed: 360, room_locked: 60 },
};
const MAX_LIFE_MS = 12 * 60 * MINUTE;
const FLAGS_TO_REMOVE = 3;
const DAILY_NOTICE_LIMIT = 10;
const SEEN_LIMIT = 50;
const POINTS = { notice: 10, answer: 3, confirmed: 5, thanks: 1 } as const;
const POINTS_NOTICES_PER_DAY = 5;
const POINTS_ANSWERS_PER_DAY = 10;
const LEVEL_POINTS = [0, 100, 300, 800, 2000] as const;
const TRUSTED_LEVEL = 3;
const ROOM = /^[A-Z0-9]{2,6}$/;

/** Os alunos inventados que reagem ao aviso do aluno da demo. */
const CROWD = {
  /** Quantos veem por minuto, até o teto. */
  viewsPerMinute: 3,
  maxViews: 60,
  confirmAfterMs: 2 * MINUTE,
  thankAfterMs: 4 * MINUTE,
};

type Notice = {
  id: string;
  kind: NoticeKind;
  status: NoticeStatus;
  place: NoticePlace;
  placeKey: string;
  /** Do aluno da demo. */
  mine: boolean;
  level: number;
  trusted: boolean;
  confirmations: number;
  ends: number;
  flags: number;
  views: number;
  thanks: number;
  createdAt: number;
  expiresAt: number;
  firstConfirmedAt: number | null;
  endedAt: number | null;
  removedAt: number | null;
};

type Answer = {
  answer: NoticeAnswer | null;
  thanked: boolean;
  flagged: boolean;
  seen: boolean;
};

function standing(points: number): Standing {
  const safe = Math.max(0, Math.floor(points));
  let index = 0;
  LEVEL_POINTS.forEach((at, i) => {
    if (safe >= at) index = i;
  });
  return {
    points: safe,
    level: index + 1,
    levelAt: LEVEL_POINTS[index],
    nextLevelAt: LEVEL_POINTS[index + 1] ?? null,
  };
}

const lifetimeMs = (kind: NoticeKind, status: NoticeStatus) =>
  (MINUTES[kind][status] ?? 60) * MINUTE;

const pad = (value: number) => String(value).padStart(2, '0');
/** O dia no fuso do aparelho, AAAA-MM-DD. */
const dayOf = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** A meia-noite da segunda-feira da semana de `now`. */
function weekStart(now: number): Date {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

/** Os dias de segunda a sexta do mês até hoje (ou o mês inteiro, se passou). */
function weekdaysOf(month: string, now: number): number {
  const [year, value] = month.split('-').map(Number);
  const today = dayOf(new Date(now));
  let total = 0;
  for (
    const date = new Date(year, value - 1, 1, 12);
    date.getMonth() === value - 1 && dayOf(date) <= today;
    date.setDate(date.getDate() + 1)
  )
    if (date.getDay() >= 1 && date.getDay() <= 5) total++;
  return total;
}

const invalid = () => new AppError('INVALID_INPUT');
const badPlace = () => new CampusNowError('place');

/** Confere o pedido como o servidor (checkNotice) e devolve o lugar limpo. */
function checkNotice({ kind, status, place }: NoticeRequest): NoticeRequest {
  if (!STATUSES_BY_KIND[kind]?.includes(status)) throw invalid();
  if (place.type !== placeTypeOf(kind, status)) throw badPlace();
  switch (place.type) {
    case 'elevators':
    case 'ru':
      return { kind, status, place: { type: place.type } };
    case 'gate':
      if (!NOTICE_GATES.includes(place.gate)) throw badPlace();
      return { kind, status, place: { type: 'gate', gate: place.gate } };
    case 'floor':
    case 'room': {
      if (!NOTICE_BLOCKS.includes(place.block)) throw badPlace();
      if (!floorsOf(place.block).includes(place.floor)) throw badPlace();
      if (place.type === 'floor')
        return {
          kind,
          status,
          place: { type: 'floor', block: place.block, floor: place.floor },
        };
      const room = place.room.trim().toUpperCase();
      if (!ROOM.test(room)) throw badPlace();
      return {
        kind,
        status,
        place: { type: 'room', block: place.block, floor: place.floor, room },
      };
    }
  }
}

export function createDemoCampus(clock: DemoClock): CampusNowServerPort {
  const notices = new Map<string, Notice>();
  const answers = new Map<string, Answer>();
  const contributor = { ...DEMO_CONTRIBUTOR };
  let today = { day: '', notices: 0, answers: 0, thanks: 0 };
  /** O aviso de cada semente, para repor quando ele vence sozinho. */
  const seeded = new Map<DemoNoticeSeed, string>();
  let sequence = 0;
  const nextId = () =>
    `demo${(++sequence).toString(36).padStart(4, '0')}${Math.random()
      .toString(36)
      .slice(2, 10)
      .padEnd(8, '0')}`;

  function plan(
    request: NoticeRequest,
    { mine, level, at }: { mine: boolean; level: number; at: number },
  ): Notice {
    return {
      id: nextId(),
      kind: request.kind,
      status: request.status,
      place: request.place,
      placeKey: placeKey(request.place),
      mine,
      level,
      trusted: level >= TRUSTED_LEVEL,
      confirmations: 0,
      ends: 0,
      flags: 0,
      views: 0,
      thanks: 0,
      createdAt: at,
      expiresAt:
        at + Math.min(MAX_LIFE_MS, lifetimeMs(request.kind, request.status)),
      firstConfirmedAt: null,
      endedAt: null,
      removedAt: null,
    };
  }

  const stateOf = (notice: Notice, now: number): NoticeState =>
    notice.removedAt
      ? 'removed'
      : notice.endedAt
        ? 'ended'
        : notice.expiresAt <= now
          ? 'expired'
          : 'active';
  const isActive = (notice: Notice, now: number) =>
    stateOf(notice, now) === 'active';
  const earlier = (a: Notice, b: Notice) =>
    a.createdAt - b.createdAt || a.id.localeCompare(b.id);

  /** O fim depois de um "Continua": a duração a partir de agora, até 12 horas. */
  const extended = (notice: Notice, now: number) =>
    Math.max(
      notice.expiresAt,
      Math.min(
        notice.createdAt + MAX_LIFE_MS,
        now + lifetimeMs(notice.kind, notice.status),
      ),
    );

  function seed(item: DemoNoticeSeed, now: number) {
    const notice = plan(item, {
      mine: false,
      level: item.level,
      at: now - item.minutesAgo * MINUTE,
    });
    notice.confirmations = item.confirmations;
    notice.views = 12 + item.minutesAgo * 2;
    if (item.confirmations) notice.firstConfirmedAt = notice.createdAt + MINUTE;
    notices.set(notice.id, notice);
    seeded.set(item, notice.id);
  }

  /** O aviso inventado que venceu sozinho volta: a demo nunca envelhece. */
  function refill(now: number) {
    for (const item of DEMO_NOTICE_SEEDS) {
      const current = notices.get(seeded.get(item) ?? '');
      if (!current || stateOf(current, now) === 'expired') seed(item, now);
    }
  }

  /** As contagens do dia do aluno da demo (zeram à meia-noite). */
  function day(now: number) {
    const key = dayOf(new Date(now));
    if (today.day !== key)
      today = { day: key, notices: 0, answers: 0, thanks: 0 };
    return today;
  }

  const earned = (value: number): Earned => ({
    ...standing(contributor.points),
    earned: value,
  });

  /** Os alunos inventados que veem, confirmam e agradecem o aviso do aluno. */
  function crowd(now: number) {
    for (const notice of notices.values()) {
      if (!notice.mine || !isActive(notice, now)) continue;
      const elapsed = now - notice.createdAt;
      const views = Math.min(
        CROWD.maxViews,
        Math.floor((elapsed / MINUTE) * CROWD.viewsPerMinute),
      );
      if (views > notice.views) {
        contributor.viewsReceived += views - notice.views;
        notice.views = views;
      }
      if (elapsed >= CROWD.confirmAfterMs && !notice.firstConfirmedAt) {
        notice.confirmations += 1;
        notice.expiresAt = extended(notice, now);
        notice.firstConfirmedAt = now;
        contributor.points += POINTS.confirmed;
        contributor.confirmedNotices += 1;
      }
      if (elapsed >= CROWD.thankAfterMs && notice.thanks === 0) {
        notice.thanks = 1;
        contributor.points += POINTS.thanks;
        contributor.thanksReceived += 1;
      }
    }
  }

  /** Antes de cada leitura: o relógio andou. */
  function tick(now: number) {
    refill(now);
    crowd(now);
  }

  function view(notice: Notice, now: number): CampusNotice {
    const answer = answers.get(notice.id);
    return {
      id: notice.id,
      kind: notice.kind,
      status: notice.status,
      place: notice.place,
      createdAt: notice.createdAt,
      expiresAt: notice.expiresAt,
      state: stateOf(notice, now),
      confirmations: notice.confirmations,
      ends: notice.ends,
      confirmed: notice.confirmations > 0 || notice.trusted,
      level: notice.trusted ? notice.level : null,
      mine: notice.mine,
      answer: answer?.answer ?? null,
      thanked: answer?.thanked ?? false,
      flagged: answer?.flagged ?? false,
      views: notice.mine ? notice.views : null,
      thanks: notice.mine ? notice.thanks : null,
    };
  }

  const answerOf = (id: string): Answer => {
    let answer = answers.get(id);
    if (!answer) {
      answer = { answer: null, thanked: false, flagged: false, seen: false };
      answers.set(id, answer);
    }
    return answer;
  };

  function activeNotice(id: string, now: number): Notice {
    const notice = notices.get(id);
    if (!notice || !isActive(notice, now)) throw new CampusNowError('gone');
    return notice;
  }

  /** Os pontos da resposta (até o limite do dia) e a contagem de sempre. */
  function answerPoints(now: number): Earned {
    const counts = day(now);
    counts.answers += 1;
    const value = counts.answers <= POINTS_ANSWERS_PER_DAY ? POINTS.answer : 0;
    contributor.points += value;
    contributor.answers += 1;
    return earned(value);
  }

  /** "Continua" de outro aluno; `null` se ele já tinha respondido. */
  function confirm(notice: Notice, now: number): Earned | null {
    const answer = answerOf(notice.id);
    if (answer.answer !== null) return null;
    answer.answer = 'confirm';
    notice.confirmations += 1;
    notice.expiresAt = extended(notice, now);
    notice.firstConfirmedAt ??= now;
    return answerPoints(now);
  }

  function report(request: NoticeRequest, now: number): NoticeResult {
    const checked = checkNotice(request);
    const key = placeKey(checked.place);
    const same = [...notices.values()].filter(
      notice =>
        notice.kind === checked.kind &&
        notice.placeKey === key &&
        isActive(notice, now),
    );
    const identical = same
      .filter(notice => notice.status === checked.status)
      .sort(earlier)[0];
    // igual a um que já vale: vira a confirmação dele
    if (identical) {
      const you = (!identical.mine && confirm(identical, now)) || earned(0);
      return {
        notice: view(identical, now),
        merged: true,
        replaced: null,
        you,
      };
    }
    const counts = day(now);
    if (counts.notices >= DAILY_NOTICE_LIMIT) throw new CampusNowError('limit');
    counts.notices += 1;
    const notice = plan(checked, {
      mine: true,
      level: standing(contributor.points).level,
      at: now,
    });
    notices.set(notice.id, notice);
    // outra situação no mesmo lugar: a anterior acabou
    let replaced: string | null = null;
    for (const other of same.sort((a, b) => earlier(b, a))) {
      other.endedAt = now;
      replaced ??= other.id;
    }
    const value = counts.notices <= POINTS_NOTICES_PER_DAY ? POINTS.notice : 0;
    contributor.points += value;
    contributor.notices += 1;
    return {
      notice: view(notice, now),
      merged: false,
      replaced,
      you: earned(value),
    };
  }

  function answerNotice(id: string, value: NoticeAnswer, now: number) {
    const notice = activeNotice(id, now);
    if (notice.mine) {
      if (value === 'confirm') throw new CampusNowError('own');
      // "Já resolveu": o "Acabou" de quem avisou encerra na hora
      notice.endedAt = now;
      return { notice: view(notice, now), you: earned(0) };
    }
    if (value === 'confirm') {
      const you = confirm(notice, now);
      if (!you) throw new CampusNowError('answered');
      return { notice: view(notice, now), you };
    }
    const answer = answerOf(id);
    if (answer.answer === 'end') throw new CampusNowError('answered');
    const previous = answer.answer;
    answer.answer = 'end';
    notice.ends += 1;
    if (notice.ends >= ENDS_TO_CLOSE) notice.endedAt = now;
    // de "Continua" para "Acabou" não dá pontos de novo
    const you = previous === null ? answerPoints(now) : earned(0);
    return { notice: view(notice, now), you };
  }

  function thank(id: string, now: number) {
    const notice = activeNotice(id, now);
    if (notice.mine) throw new CampusNowError('own');
    const answer = answerOf(id);
    if (!answer.thanked) {
      answer.thanked = true;
      notice.thanks += 1;
      day(now).thanks += 1;
    }
    return { notice: view(notice, now), you: earned(0) };
  }

  function flag(id: string, now: number) {
    const notice = activeNotice(id, now);
    if (notice.mine) throw new CampusNowError('own');
    const answer = answerOf(id);
    if (answer.flagged) return;
    answer.flagged = true;
    notice.flags += 1;
    if (notice.flags >= FLAGS_TO_REMOVE) notice.removedAt = now;
  }

  function seen(ids: readonly string[]) {
    for (const id of [...new Set(ids)].slice(0, SEEN_LIMIT)) {
      const notice = notices.get(id);
      if (!notice || notice.mine) continue;
      const answer = answerOf(id);
      if (answer.seen) continue;
      answer.seen = true;
      notice.views += 1;
    }
  }

  /** Os avisos do aluno da demo desde a segunda-feira (fora os tirados do ar). */
  const mineThisWeek = (now: number) =>
    [...notices.values()].filter(
      notice =>
        notice.mine &&
        !notice.removedAt &&
        notice.createdAt >= weekStart(now).getTime(),
    );

  function summary(now: number): YouSummary {
    const week = mineThisWeek(now);
    const todayKey = dayOf(new Date(now));
    return {
      you: standing(contributor.points),
      counts: {
        notices: contributor.notices,
        answers: contributor.answers,
        confirmedNotices: contributor.confirmedNotices,
        thanksReceived: contributor.thanksReceived,
        viewsReceived: contributor.viewsReceived,
      },
      week: {
        notices: DEMO_WEEK.notices + week.length,
        views:
          DEMO_WEEK.views + week.reduce((sum, item) => sum + item.views, 0),
        thanks:
          DEMO_WEEK.thanks + week.reduce((sum, item) => sum + item.thanks, 0),
      },
      today: [...notices.values()]
        .filter(
          notice =>
            notice.mine && dayOf(new Date(notice.createdAt)) === todayKey,
        )
        .sort((a, b) => earlier(b, a))
        .map(notice => view(notice, now)),
    };
  }

  function community(month: string, now: number): CommunitySummary {
    const current = monthOf(new Date(now));
    if (month !== current && month !== previousMonth(current)) throw invalid();
    const weekdays = weekdaysOf(month, now);
    // os problemas crescem com o mês: no começo, poucos dias e poucos avisos
    const problems = DEMO_PROBLEMS[month === current ? 'current' : 'previous']
      .map(({ share, ...problem }) => {
        const days = Math.min(
          weekdays,
          Math.max(1, Math.round(share * weekdays)),
        );
        return {
          ...problem,
          days,
          notices: Math.max(
            days,
            Math.round((problem.notices * weekdays) / 21),
          ),
        };
      })
      .filter(() => weekdays > 0);
    const week = mineThisWeek(now);
    const answered = [...answers.values()].filter(item => item.answer).length;
    return {
      week: {
        from: dayOf(weekStart(now)),
        notices: DEMO_CAMPUS_WEEK.notices + week.length,
        answers: DEMO_CAMPUS_WEEK.answers + answered,
        views:
          DEMO_CAMPUS_WEEK.views +
          week.reduce((sum, item) => sum + item.views, 0),
        minutesToEnd: DEMO_CAMPUS_WEEK.minutesToEnd,
      },
      month: {
        month,
        weekdays,
        notices:
          problems.reduce((sum, item) => sum + item.notices, 0) +
          Math.round(weekdays / 2),
        problems,
      },
    };
  }

  refill(clock.now());

  /** Faz a ação depois da espera da resposta, com o relógio de então. */
  const act = <T>(run: (now: number) => T, signal?: AbortSignal) =>
    clock.respond(() => {
      const now = clock.now();
      tick(now);
      return run(now);
    }, signal);

  return {
    list: options =>
      act(now => {
        const helped =
          today.day === dayOf(new Date(now)) &&
          today.notices + today.answers + today.thanks > 0;
        return {
          notices: [...notices.values()]
            .filter(notice => isActive(notice, now))
            .sort((a, b) => earlier(b, a))
            .map(notice => view(notice, now)),
          helpersToday: DEMO_HELPERS_TODAY + (helped ? 1 : 0),
          you: standing(contributor.points),
        };
      }, options?.signal),
    report: request => act(now => report(request, now)),
    answer: (id, value) => act(now => answerNotice(id, value, now)),
    thank: id => act(now => thank(id, now)),
    flag: id => act(now => flag(id, now)),
    seen: ids => act(() => seen(ids)),
    you: options => act(now => summary(now), options?.signal),
    community: (month, options) =>
      act(now => community(month, now), options?.signal),
  };
}

/**
 * O Agora no campus em segundo plano do iPhone na demo: sem servidor, não há
 * push, e a chave de avisos do campus não aparece no iPhone. No Android, a
 * demo segue pela tarefa sem tela, lendo a lista de mentira.
 */
export function createDemoCampusPush(): CampusPushServerPort {
  return {
    status: async () => ({ available: false, registered: false }),
    register: async () => {
      throw new AppError('SERVICE_UNAVAILABLE');
    },
    unregister: async () => undefined,
  };
}
