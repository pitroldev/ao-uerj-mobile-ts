import { randomBytes } from 'node:crypto';

import { DomainError, InvalidInputError } from '../../shared/errors.ts';

/*
 * Agora no campus: avisos curtos dos próprios alunos sobre o campus (a fila
 * dos elevadores, o bandejão, a luz, o Wi-Fi, os banheiros, um portão
 * fechado), que somem sozinhos. Quem está no lugar avisa; quem passa por ali
 * confirma ("Continua") ou diz que acabou. Não há texto livre: o tipo, a
 * situação e o lugar vêm de listas fechadas, então não há o que moderar além
 * de um aviso falso. Os outros alunos não veem quem avisou; o servidor sabe
 * (a sessão), para os pontos, os limites e a moderação.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const NOTICE_KINDS = [
  'elevators',
  'ru',
  'power',
  'internet',
  'restroom',
  'access',
] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

/** O tipo de lugar que cada situação pede. */
export type PlaceType = 'elevators' | 'ru' | 'gate' | 'floor' | 'room';

/**
 * As situações de cada tipo: o lugar que pedem e quanto tempo valem (em
 * minutos, desde a criação ou o último "Continua").
 */
export const STATUSES = {
  elevators: {
    short_queue: { place: 'elevators', minutes: 45 },
    long_queue: { place: 'elevators', minutes: 60 },
    stopped: { place: 'elevators', minutes: 180 },
  },
  ru: {
    short_queue: { place: 'ru', minutes: 30 },
    long_queue: { place: 'ru', minutes: 30 },
    closed: { place: 'ru', minutes: 120 },
  },
  power: {
    no_power: { place: 'floor', minutes: 120 },
    no_ac: { place: 'floor', minutes: 120 },
    no_outlets: { place: 'floor', minutes: 120 },
  },
  internet: {
    wifi_down: { place: 'floor', minutes: 120 },
    wifi_slow: { place: 'floor', minutes: 120 },
  },
  restroom: {
    no_water: { place: 'floor', minutes: 120 },
    closed: { place: 'floor', minutes: 180 },
    no_paper: { place: 'floor', minutes: 120 },
  },
  access: {
    gate_closed: { place: 'gate', minutes: 360 },
    ramp_closed: { place: 'floor', minutes: 360 },
    room_locked: { place: 'room', minutes: 60 },
  },
} as const satisfies Record<
  NoticeKind,
  Record<string, { place: PlaceType; minutes: number }>
>;

type StatusOf<K extends NoticeKind> = Extract<
  keyof (typeof STATUSES)[K],
  string
>;
export type NoticeStatus = { [K in NoticeKind]: StatusOf<K> }[NoticeKind];

/** Todas as situações, sem repetir (a mesma pode valer em dois tipos). */
export const STATUS_IDS = [
  ...new Set(NOTICE_KINDS.flatMap(kind => Object.keys(STATUSES[kind]))),
] as NoticeStatus[];

export const BLOCKS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export type Block = (typeof BLOCKS)[number];

/** Os portões do atlas do Mapa do app. */
export const GATES = [
  'portao-metro',
  'portao-leste',
  'portao-sudeste',
  'portao-sfx',
  'portao-oeste',
  'portao-radial',
] as const;
export type Gate = (typeof GATES)[number];

/** Térreo e os andares de 1 a 12; o subsolo só existe no bloco F. */
const FLOORS = ['T', ...Array.from({ length: 12 }, (_, i) => String(i + 1))];
const floorsOf = (block: Block) => (block === 'F' ? ['SE', ...FLOORS] : FLOORS);

/** O código da sala como na grade ("6019", "T014"), em maiúsculas. */
const ROOM = /^[A-Z0-9]{2,6}$/;

export type Place =
  | { type: 'elevators' }
  | { type: 'ru' }
  | { type: 'gate'; gate: Gate }
  | { type: 'floor'; block: Block; floor: string }
  | { type: 'room'; block: Block; floor: string; room: string };

export type NoticeRequest = {
  kind: NoticeKind;
  status: NoticeStatus;
  place: Place;
};

/** O que cada aluno responde a um aviso. */
export type AnswerValue = 'confirm' | 'end';

/** Quanto tempo um aviso vale, no máximo, contado da criação. */
export const MAX_LIFE_MS = 12 * HOUR;
/** "Acabou" de alunos diferentes que encerram um aviso. */
export const ENDS_TO_CLOSE = 3;
/** "Não é verdade" de alunos diferentes que tiram o aviso do ar. */
export const FLAGS_TO_REMOVE = 3;
/** Teto de avisos valendo ao mesmo tempo, no campus inteiro. */
export const MAX_ACTIVE_NOTICES = 300;
/** Avisos novos por aluno por dia (de São Paulo). */
export const DAILY_NOTICE_LIMIT = 10;
/** Quantos ids um pedido de "vistos" leva. */
export const SEEN_LIMIT = 50;

/** Os pontos de cada coisa. */
export const POINTS = {
  /** Avisar algo novo. */
  notice: 10,
  /** A primeira resposta a um aviso ("Continua" ou "Acabou"). */
  answer: 3,
  /** O próprio aviso confirmado pela primeira vez por outro aluno. */
  confirmed: 5,
  /** Cada "Valeu" recebido. */
  thanks: 1,
  /** O próprio aviso tirado do ar (denúncias ou moderação). */
  removed: -15,
} as const;

/** Por dia, só os primeiros avisos e as primeiras respostas dão pontos. */
export const POINTS_NOTICES_PER_DAY = 5;
export const POINTS_ANSWERS_PER_DAY = 10;

/** A partir de quantos pontos vale cada nível (o 1 vale desde o começo). */
export const LEVEL_POINTS = [0, 100, 300, 800, 2000] as const;
/** Do nível 3 em diante, o aviso vale direto, sem esperar confirmação. */
export const TRUSTED_LEVEL = 3;

/** Os avisos ficam 70 dias (o resumo do mês anterior); o índice TTL apaga. */
export const NOTICE_RETENTION_MS = 70 * DAY;
/** As respostas ficam até 2 dias depois do fim mais longe possível do aviso. */
export const ANSWER_RETENTION_MS = MAX_LIFE_MS + 2 * DAY;
/** As contagens do dia de cada aluno ficam 3 dias. */
export const DAY_RETENTION_MS = 3 * DAY;

/** Quem sumiu o aviso antes da hora. */
export type EndedBy = 'answers' | 'reporter' | 'replaced';
/** Quem tirou o aviso do ar. */
export type RemovedBy = 'flags' | 'moderation' | 'ban';

/** O aviso como fica guardado. */
export type Notice = {
  id: string;
  kind: NoticeKind;
  status: NoticeStatus;
  place: Place;
  /** O lugar numa chave ("floor:B:6"), para achar o mesmo aviso. */
  placeKey: string;
  /** O aluno que avisou (a moderação vê; os outros alunos, não). */
  reporter: string;
  /** O nível de quem avisou, na hora. */
  level: number;
  /** Vale direto: quem avisou tinha o nível de confiança. */
  trusted: boolean;
  confirmations: number;
  ends: number;
  flags: number;
  views: number;
  thanks: number;
  createdAt: Date;
  expiresAt: Date;
  firstConfirmedAt: Date | null;
  endedAt: Date | null;
  endedBy: EndedBy | null;
  removedAt: Date | null;
  removedBy: RemovedBy | null;
  /** Quem avisou perdeu os pontos de aviso tirado do ar (uma vez só). */
  penalized: boolean;
  /** A moderação já olhou: manteve (as denúncias não tiram mais) ou tirou. */
  reviewedAt: Date | null;
  /** Quando o banco apaga. */
  purgeAt: Date;
};

export type NoticeState = 'active' | 'ended' | 'expired' | 'removed';

export function noticeState(notice: Notice, now: Date): NoticeState {
  if (notice.removedAt) return 'removed';
  if (notice.endedAt) return 'ended';
  if (notice.expiresAt <= now) return 'expired';
  return 'active';
}

export const isActive = (notice: Notice, now: Date) =>
  noticeState(notice, now) === 'active';

/** Vale para todos: outro aluno confirmou, ou quem avisou é de confiança. */
export const isConfirmed = (notice: Notice) =>
  notice.confirmations > 0 || notice.trusted;

/** O que um aluno fez com um aviso: uma linha por par aviso e aluno. */
export type Answer = {
  notice: string;
  student: string;
  answer: AnswerValue | null;
  thanked: boolean;
  flagged: boolean;
  seen: boolean;
};

/** A chave da resposta de um aluno a um aviso. */
export const answerId = (notice: string, student: string) =>
  `${notice}:${student}`;

/** Os pontos e as contagens de sempre de um aluno. */
export type Contributor = {
  student: string;
  points: number;
  notices: number;
  answers: number;
  confirmedNotices: number;
  thanksReceived: number;
  viewsReceived: number;
};

export type ContributorChange = Partial<Omit<Contributor, 'student'>>;

export const emptyContributor = (student: string): Contributor => ({
  student,
  points: 0,
  notices: 0,
  answers: 0,
  confirmedNotices: 0,
  thanksReceived: 0,
  viewsReceived: 0,
});

/** As contagens do dia de um aluno, para os limites e os pontos. */
export type DayCounts = { notices: number; answers: number; thanks: number };
export type DayField = keyof DayCounts;

/** O nível e a faixa de pontos dele. */
export type Standing = {
  points: number;
  level: number;
  levelAt: number;
  nextLevelAt: number | null;
};

export function standing(points: number): Standing {
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

/** O id do aviso: 12 bytes ao acaso (16 caracteres base64url). */
export const newNoticeId = () => randomBytes(12).toString('base64url');
export const NOTICE_ID = /^[A-Za-z0-9_-]{16}$/;

const invalidPlace = (message: string) =>
  new DomainError('invalid_place', message);

/**
 * Confere o pedido: a situação é do tipo, e o lugar é do tipo que a
 * situação pede (com o andar que o bloco tem). Devolve o lugar só com os
 * campos dele.
 */
export function checkNotice(request: NoticeRequest): NoticeRequest {
  const { kind, status, place } = request;
  const statuses = STATUSES[kind] as Record<
    string,
    { place: PlaceType; minutes: number }
  >;
  const rule = Object.hasOwn(statuses, status) ? statuses[status] : undefined;
  if (!rule) throw new InvalidInputError(`status ${status} is not for ${kind}`);
  if (place.type !== rule.place)
    throw invalidPlace(`${kind} ${status} needs a place of type ${rule.place}`);
  switch (place.type) {
    case 'elevators':
    case 'ru':
      return { kind, status, place: { type: place.type } };
    case 'gate':
      if (!GATES.includes(place.gate)) throw invalidPlace('Unknown gate');
      return { kind, status, place: { type: 'gate', gate: place.gate } };
    case 'floor':
    case 'room': {
      if (!BLOCKS.includes(place.block)) throw invalidPlace('Unknown block');
      if (!floorsOf(place.block).includes(place.floor))
        throw invalidPlace(`Block ${place.block} has no floor ${place.floor}`);
      if (place.type === 'floor')
        return {
          kind,
          status,
          place: { type: 'floor', block: place.block, floor: place.floor },
        };
      const room = place.room.trim().toUpperCase();
      if (!ROOM.test(room)) throw invalidPlace('The room code is malformed');
      return {
        kind,
        status,
        place: { type: 'room', block: place.block, floor: place.floor, room },
      };
    }
  }
}

/** O lugar numa chave, para achar o mesmo aviso. */
export function placeKey(place: Place): string {
  switch (place.type) {
    case 'elevators':
    case 'ru':
      return place.type;
    case 'gate':
      return `gate:${place.gate}`;
    case 'floor':
      return `floor:${place.block}:${place.floor}`;
    case 'room':
      return `room:${place.block}:${place.room}`;
  }
}

/** Quanto a situação vale, em ms. */
export function lifetimeMs(kind: NoticeKind, status: NoticeStatus): number {
  const statuses = STATUSES[kind] as Record<string, { minutes: number }>;
  return (statuses[status]?.minutes ?? 60) * MINUTE;
}

/**
 * O fim depois de um "Continua" agora: a duração da situação a partir de
 * agora, nunca além das 12 horas da criação e nunca antes do fim de antes.
 */
export function extendedExpiry(notice: Notice, now: Date): Date {
  const limit = notice.createdAt.getTime() + MAX_LIFE_MS;
  const pushed = Math.min(
    limit,
    now.getTime() + lifetimeMs(notice.kind, notice.status),
  );
  return new Date(Math.max(notice.expiresAt.getTime(), pushed));
}

/** O aviso novo, a partir do pedido já conferido. */
export function planNotice(
  request: NoticeRequest,
  {
    id,
    reporter,
    level,
    now,
  }: { id: string; reporter: string; level: number; now: Date },
): Notice {
  const created = now.getTime();
  return {
    id,
    kind: request.kind,
    status: request.status,
    place: request.place,
    placeKey: placeKey(request.place),
    reporter,
    level,
    trusted: level >= TRUSTED_LEVEL,
    confirmations: 0,
    ends: 0,
    flags: 0,
    views: 0,
    thanks: 0,
    createdAt: now,
    expiresAt: new Date(
      Math.min(
        created + MAX_LIFE_MS,
        created + lifetimeMs(request.kind, request.status),
      ),
    ),
    firstConfirmedAt: null,
    endedAt: null,
    endedBy: null,
    removedAt: null,
    removedBy: null,
    penalized: false,
    reviewedAt: null,
    purgeAt: new Date(created + NOTICE_RETENTION_MS),
  };
}

/** A ordem de quem chegou primeiro: a hora e, no empate, o id. */
export const earlier = (a: Notice, b: Notice) =>
  a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);

/** O aviso como um aluno o vê: os números de todos e o que ele fez. */
export type NoticeView = {
  id: string;
  kind: NoticeKind;
  status: NoticeStatus;
  place: Place;
  createdAt: Date;
  expiresAt: Date;
  state: NoticeState;
  confirmations: number;
  ends: number;
  confirmed: boolean;
  level: number | null;
  mine: boolean;
  answer: AnswerValue | null;
  thanked: boolean;
  flagged: boolean;
  views: number | null;
  thanks: number | null;
};

export function noticeView(
  notice: Notice,
  student: string,
  answer: Answer | null | undefined,
  now: Date,
): NoticeView {
  const mine = notice.reporter === student;
  return {
    id: notice.id,
    kind: notice.kind,
    status: notice.status,
    place: notice.place,
    createdAt: notice.createdAt,
    expiresAt: notice.expiresAt,
    state: noticeState(notice, now),
    confirmations: notice.confirmations,
    ends: notice.ends,
    confirmed: isConfirmed(notice),
    level: notice.trusted ? notice.level : null,
    mine,
    answer: answer?.answer ?? null,
    thanked: answer?.thanked ?? false,
    flagged: answer?.flagged ?? false,
    views: mine ? notice.views : null,
    thanks: mine ? notice.thanks : null,
  };
}

/* ------------------------------------------------- o tempo de São Paulo */

/*
 * Os dias e as horas contam em São Paulo, que está em -03:00 o ano todo
 * desde que o horário de verão acabou (2019).
 */
const OFFSET = '-03:00';

const SAO_PAULO = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** O dia (AAAA-MM-DD), a hora (0–23) e o dia da semana (0 = domingo). */
export function saoPaulo(date: Date): {
  day: string;
  hour: number;
  weekday: number;
} {
  const parts = Object.fromEntries(
    SAO_PAULO.formatToParts(date).map(part => [part.type, part.value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour) % 24,
    weekday: WEEKDAYS.indexOf(parts.weekday ?? ''),
  };
}

/** A meia-noite de um dia de São Paulo. */
export const startOfDay = (day: string) => new Date(`${day}T00:00:00${OFFSET}`);

/** O dia de São Paulo `days` dias depois (ou antes) de `day`. */
export function addDays(day: string, days: number): string {
  const noon = new Date(`${day}T12:00:00${OFFSET}`);
  return saoPaulo(new Date(noon.getTime() + days * DAY)).day;
}

/** A segunda-feira (AAAA-MM-DD) da semana de `now`. */
export function weekStart(now: Date): string {
  const { day, weekday } = saoPaulo(now);
  return addDays(day, -((weekday + 6) % 7));
}

/** O mês (AAAA-MM) de `now` e o anterior. */
export function monthOf(now: Date): string {
  return saoPaulo(now).day.slice(0, 7);
}

export function previousMonth(month: string): string {
  const [year, value] = month.split('-').map(Number);
  return value === 1
    ? `${year - 1}-12`
    : `${year}-${String(value - 1).padStart(2, '0')}`;
}

function nextMonth(month: string): string {
  const [year, value] = month.split('-').map(Number);
  return value === 12
    ? `${year + 1}-01`
    : `${year}-${String(value + 1).padStart(2, '0')}`;
}

/** O começo e o fim (exclusivo) de um mês de São Paulo. */
export function monthRange(month: string): { from: Date; to: Date } {
  return {
    from: startOfDay(`${month}-01`),
    to: startOfDay(`${nextMonth(month)}-01`),
  };
}

/**
 * Os dias de segunda a sexta do mês até hoje (o de hoje inclusive) ou do
 * mês inteiro, se ele já passou.
 */
export function weekdaysOf(month: string, now: Date): number {
  const today = saoPaulo(now).day;
  let total = 0;
  for (let day = `${month}-01`; day.startsWith(month); day = addDays(day, 1)) {
    if (day > today) break;
    const { weekday } = saoPaulo(new Date(`${day}T12:00:00${OFFSET}`));
    if (weekday >= 1 && weekday <= 5) total++;
  }
  return total;
}

/* ------------------------------------------------- o campus somado */

/** Um problema que se repete: o tipo, a situação e a área. */
export type Problem = {
  kind: NoticeKind;
  status: NoticeStatus;
  block: Block | null;
  gate: Gate | null;
  days: number;
  notices: number;
  minutesToEnd: number | null;
  peakHours: number[];
};

/** Quantos problemas o mês mostra. */
export const PROBLEMS_SHOWN = 6;

/** Os encerrados pelos alunos (respostas ou quem avisou) contam no tempo até acabar. */
const endedByStudents = (notice: Notice) =>
  notice.endedAt !== null &&
  (notice.endedBy === 'answers' || notice.endedBy === 'reporter');

function minutesToEnd(notices: readonly Notice[]): number | null {
  const ended = notices.filter(endedByStudents);
  if (!ended.length) return null;
  const total = ended.reduce(
    (sum, notice) =>
      sum + (notice.endedAt!.getTime() - notice.createdAt.getTime()),
    0,
  );
  return Math.round(total / ended.length / MINUTE);
}

/** A semana somada: os avisos que não saíram do ar. */
export function weekSummary(notices: readonly Notice[]) {
  const counted = notices.filter(notice => !notice.removedAt);
  return {
    notices: counted.length,
    answers: counted.reduce(
      (sum, notice) => sum + notice.confirmations + notice.ends,
      0,
    ),
    views: counted.reduce((sum, notice) => sum + notice.views, 0),
    minutesToEnd: minutesToEnd(counted),
  };
}

/** A área de um lugar: o bloco (andar ou sala), o portão ou nada. */
function areaOf(place: Place): { block: Block | null; gate: Gate | null } {
  if (place.type === 'floor' || place.type === 'room')
    return { block: place.block, gate: null };
  if (place.type === 'gate') return { block: null, gate: place.gate };
  return { block: null, gate: null };
}

/**
 * O mês somado: só os avisos confirmados que não saíram do ar, juntados por
 * tipo, situação e área. Os que se repetem em mais dias vêm primeiro.
 */
export function monthSummary(notices: readonly Notice[]) {
  const counted = notices.filter(
    notice => !notice.removedAt && isConfirmed(notice),
  );
  const groups = new Map<
    string,
    { area: ReturnType<typeof areaOf>; notice: Notice; items: Notice[] }
  >();
  for (const notice of counted) {
    const area = areaOf(notice.place);
    const key = `${notice.kind}|${notice.status}|${area.block ?? ''}|${area.gate ?? ''}`;
    const group = groups.get(key);
    if (group) group.items.push(notice);
    else groups.set(key, { area, notice, items: [notice] });
  }
  const problems: Problem[] = [...groups.values()].map(
    ({ area, notice, items }) => {
      const hours = new Map<number, number>();
      for (const item of items) {
        const { hour } = saoPaulo(item.createdAt);
        hours.set(hour, (hours.get(hour) ?? 0) + 1);
      }
      return {
        kind: notice.kind,
        status: notice.status,
        block: area.block,
        gate: area.gate,
        days: new Set(items.map(item => saoPaulo(item.createdAt).day)).size,
        notices: items.length,
        minutesToEnd: minutesToEnd(items),
        peakHours: [...hours.entries()]
          .sort(([ha, a], [hb, b]) => b - a || ha - hb)
          .slice(0, 2)
          .map(([hour]) => hour),
      };
    },
  );
  problems.sort(
    (a, b) =>
      b.days - a.days ||
      b.notices - a.notices ||
      `${a.kind}${a.status}`.localeCompare(`${b.kind}${b.status}`),
  );
  return {
    notices: counted.length,
    problems: problems.slice(0, PROBLEMS_SHOWN),
  };
}
