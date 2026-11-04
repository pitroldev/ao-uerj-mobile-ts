/*
 * Agora no campus: avisos curtos dos próprios alunos sobre o campus
 * (elevadores, fila do bandejão, luz e ar, internet, banheiros, acesso), que
 * somem sozinhos. Quem está no lugar avisa em dois toques; quem passa por
 * ali confirma ("Continua") ou diz que acabou. Não há texto livre: o tipo, a
 * situação e o lugar vêm destas listas, as mesmas do servidor
 * (server/src/modules/campus-now/domain.ts). Os outros alunos não veem quem
 * avisou; os pontos e o nível valem na conta, sem placar entre alunos.
 */

export type NoticeKind =
  'elevators' | 'ru' | 'power' | 'internet' | 'restroom' | 'access';

export type NoticeStatus =
  | 'short_queue'
  | 'long_queue'
  | 'stopped'
  | 'closed'
  | 'no_power'
  | 'no_ac'
  | 'no_outlets'
  | 'wifi_down'
  | 'wifi_slow'
  | 'no_water'
  | 'no_paper'
  | 'gate_closed'
  | 'ramp_closed'
  | 'room_locked';

export type NoticeBlock = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
/** `SE` (subsolo, só no F), `T` (térreo) ou o andar, de 1 a 12. */
export type NoticeFloor = string;
export type NoticeGate =
  | 'portao-metro'
  | 'portao-leste'
  | 'portao-sudeste'
  | 'portao-sfx'
  | 'portao-oeste'
  | 'portao-radial';

export type NoticePlace =
  | { type: 'elevators' }
  | { type: 'ru' }
  | { type: 'gate'; gate: NoticeGate }
  | { type: 'floor'; block: NoticeBlock; floor: NoticeFloor }
  | { type: 'room'; block: NoticeBlock; floor: NoticeFloor; room: string };

export type PlaceType = NoticePlace['type'];

/** A ordem em que o app oferece os tipos (a grade de 2 por 3 da folha). */
export const NOTICE_KINDS: readonly NoticeKind[] = [
  'elevators',
  'ru',
  'power',
  'internet',
  'restroom',
  'access',
];

/** As situações de cada tipo, na ordem dos botões. */
export const STATUSES_BY_KIND: Readonly<
  Record<NoticeKind, readonly NoticeStatus[]>
> = {
  elevators: ['short_queue', 'long_queue', 'stopped'],
  ru: ['short_queue', 'long_queue', 'closed'],
  power: ['no_power', 'no_ac', 'no_outlets'],
  internet: ['wifi_down', 'wifi_slow'],
  restroom: ['no_water', 'closed', 'no_paper'],
  access: ['gate_closed', 'ramp_closed', 'room_locked'],
};

export const NOTICE_STATUSES: readonly NoticeStatus[] = [
  ...new Set(NOTICE_KINDS.flatMap(kind => STATUSES_BY_KIND[kind])),
];

export const NOTICE_BLOCKS: readonly NoticeBlock[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
];

/** Os portões do atlas do Mapa, na ordem dos números (1, 3, 4, 5, 6, 7). */
export const NOTICE_GATES: readonly NoticeGate[] = [
  'portao-metro',
  'portao-leste',
  'portao-sudeste',
  'portao-sfx',
  'portao-oeste',
  'portao-radial',
];

/** Os andares de um bloco, de baixo para cima (o subsolo só existe no F). */
export function floorsOf(block: NoticeBlock): NoticeFloor[] {
  return [
    ...(block === 'F' ? ['SE'] : []),
    'T',
    ...Array.from({ length: 12 }, (_, index) => String(index + 1)),
  ];
}

/** O tipo de lugar que cada situação pede. */
export function placeTypeOf(kind: NoticeKind, status: NoticeStatus): PlaceType {
  if (kind === 'elevators') return 'elevators';
  if (kind === 'ru') return 'ru';
  if (kind === 'access') {
    if (status === 'gate_closed') return 'gate';
    if (status === 'room_locked') return 'room';
  }
  return 'floor';
}

/** O mesmo lugar para o servidor: dois avisos iguais aqui viram um só. */
export function placeKey(place: NoticePlace): string {
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

export type NoticeState = 'active' | 'ended' | 'expired' | 'removed';
export type NoticeAnswer = 'confirm' | 'end';

/** Um aviso, como quem pergunta o vê. Horários em ms desde 1970. */
export type CampusNotice = {
  id: string;
  kind: NoticeKind;
  status: NoticeStatus;
  place: NoticePlace;
  createdAt: number;
  expiresAt: number;
  state: NoticeState;
  /** Quantos outros alunos disseram "Continua". */
  confirmations: number;
  /** Quantos disseram "Acabou" (três encerram). */
  ends: number;
  /** Vale para todos (alguém confirmou, ou quem avisou tem nível 3+). */
  confirmed: boolean;
  /** O nível de quem avisou, quando é 3 ou mais; senão `null`. */
  level: number | null;
  mine: boolean;
  answer: NoticeAnswer | null;
  thanked: boolean;
  flagged: boolean;
  /** Só no aviso do próprio aluno. */
  views: number | null;
  thanks: number | null;
};

/** Os pontos do aluno: o nível, de onde ele começa e onde vem o próximo. */
export type Standing = {
  points: number;
  level: number;
  levelAt: number;
  nextLevelAt: number | null;
};

/** O que uma ação rendeu. */
export type Earned = Standing & { earned: number };

export type NoticeList = {
  notices: CampusNotice[];
  helpersToday: number;
  you: Standing;
};

export type NoticeRequest = {
  kind: NoticeKind;
  status: NoticeStatus;
  place: NoticePlace;
};

export type NoticeResult = {
  notice: CampusNotice;
  /** Já havia um igual: o pedido virou a confirmação dele. */
  merged: boolean;
  /** O aviso do mesmo lugar com outra situação, que este encerrou. */
  replaced: string | null;
  you: Earned;
};

export type NoticeAction = { notice: CampusNotice; you: Earned };

export type YouSummary = {
  you: Standing;
  counts: {
    notices: number;
    answers: number;
    confirmedNotices: number;
    thanksReceived: number;
    viewsReceived: number;
  };
  week: { notices: number; views: number; thanks: number };
  today: CampusNotice[];
};

export type CampusProblem = {
  kind: NoticeKind;
  status: NoticeStatus;
  block: NoticeBlock | null;
  gate: NoticeGate | null;
  days: number;
  notices: number;
  minutesToEnd: number | null;
  peakHours: number[];
};

export type CommunitySummary = {
  week: {
    /** A segunda-feira da semana, AAAA-MM-DD. */
    from: string;
    notices: number;
    answers: number;
    views: number;
    minutesToEnd: number | null;
  };
  month: {
    /** AAAA-MM. */
    month: string;
    weekdays: number;
    notices: number;
    problems: CampusProblem[];
  };
};

/** Quantos "Acabou" encerram um aviso de outra pessoa. */
export const ENDS_TO_CLOSE = 3;

/** Vale agora: na lista e antes do fim. */
export function isLive(notice: CampusNotice, now: number): boolean {
  return notice.state === 'active' && notice.expiresAt > now;
}

/**
 * As recusas do servidor que o app explica: o aviso acabou (`gone`), é do
 * próprio aluno (`own`), ele já respondeu (`answered`), o lugar não serve
 * (`place`), o teto do dia (`limit`) e o campus cheio de avisos (`full`).
 */
export type NoticeRefusal =
  'gone' | 'own' | 'answered' | 'place' | 'limit' | 'full';

export class CampusNowError extends Error {
  constructor(readonly refusal: NoticeRefusal) {
    super(refusal);
    this.name = 'CampusNowError';
  }
}

/**
 * O mês (AAAA-MM) de uma data, no fuso do aparelho: para quem estuda no
 * campus, o mesmo de São Paulo que o servidor usa.
 */
export function monthOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** O mês anterior a AAAA-MM. */
export function previousMonth(month: string): string {
  const [year, value] = month.split('-').map(Number);
  return value === 1
    ? `${year - 1}-12`
    : `${year}-${String(value - 1).padStart(2, '0')}`;
}
