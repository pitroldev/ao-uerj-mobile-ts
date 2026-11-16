import type {
  CampusProblem,
  NoticeKind,
  NoticePlace,
  NoticeStatus,
} from '@root/modules/campus-now/domain/campusNow';

/*
 * O Agora no campus da demo: os avisos de outros alunos que já estão no ar,
 * os números do aluno da demo e os do campus. Tudo inventado; os lugares são
 * os do Mapa (blocos do Pavilhão João Lyra Filho, portões do atlas).
 */

export type DemoNoticeSeed = {
  kind: NoticeKind;
  status: NoticeStatus;
  place: NoticePlace;
  /** Há quantos minutos foi avisado. */
  minutesAgo: number;
  confirmations: number;
  /** O nível de quem avisou (3 ou mais: vale direto). */
  level: number;
};

export const DEMO_NOTICE_SEEDS: readonly DemoNoticeSeed[] = [
  // ainda sem confirmação: quem usa a demo pode dizer "Continua"
  {
    kind: 'elevators',
    status: 'long_queue',
    place: { type: 'elevators' },
    minutesAgo: 6,
    confirmations: 0,
    level: 1,
  },
  {
    kind: 'power',
    status: 'no_ac',
    place: { type: 'floor', block: 'F', floor: '9' },
    minutesAgo: 25,
    confirmations: 2,
    level: 2,
  },
  // Portão 7, na Radial Oeste
  {
    kind: 'access',
    status: 'gate_closed',
    place: { type: 'gate', gate: 'portao-radial' },
    minutesAgo: 50,
    confirmations: 1,
    level: 3,
  },
];

/** Os pontos e as contagens de sempre do aluno da demo, antes de hoje. */
export const DEMO_CONTRIBUTOR = {
  points: 140,
  notices: 9,
  answers: 17,
  confirmedNotices: 6,
  thanksReceived: 11,
  viewsReceived: 214,
};

/** A semana do aluno antes de hoje: avisos, quantos viram e os "Valeu". */
export const DEMO_WEEK = { notices: 2, views: 38, thanks: 4 };

/** Quantos alunos ajudaram hoje, fora o da demo. */
export const DEMO_HELPERS_TODAY = 23;

/** A semana do campus antes das ações da demo. */
export const DEMO_CAMPUS_WEEK = {
  notices: 41,
  answers: 96,
  views: 1830,
  minutesToEnd: 38,
};

type Problem = Omit<CampusProblem, 'days'> & {
  /** A fração dos dias úteis em que se repetiu. */
  share: number;
};

/** Os problemas que se repetem no mês corrente e no anterior. */
export const DEMO_PROBLEMS: Readonly<
  Record<'current' | 'previous', readonly Problem[]>
> = {
  current: [
    {
      kind: 'elevators',
      status: 'long_queue',
      block: null,
      gate: null,
      share: 0.8,
      notices: 31,
      minutesToEnd: 25,
      peakHours: [7, 12],
    },
    {
      kind: 'ru',
      status: 'long_queue',
      block: null,
      gate: null,
      share: 0.7,
      notices: 22,
      minutesToEnd: 35,
      peakHours: [12, 11],
    },
    {
      kind: 'power',
      status: 'no_ac',
      block: 'F',
      gate: null,
      share: 0.45,
      notices: 12,
      minutesToEnd: 95,
      peakHours: [14, 15],
    },
    {
      kind: 'internet',
      status: 'wifi_slow',
      block: 'B',
      gate: null,
      share: 0.3,
      notices: 8,
      minutesToEnd: null,
      peakHours: [10],
    },
    {
      kind: 'restroom',
      status: 'no_paper',
      block: 'D',
      gate: null,
      share: 0.2,
      notices: 5,
      minutesToEnd: 70,
      peakHours: [16],
    },
  ],
  previous: [
    {
      kind: 'elevators',
      status: 'stopped',
      block: null,
      gate: null,
      share: 0.6,
      notices: 27,
      minutesToEnd: 110,
      peakHours: [8, 18],
    },
    {
      kind: 'ru',
      status: 'long_queue',
      block: null,
      gate: null,
      share: 0.55,
      notices: 19,
      minutesToEnd: 30,
      peakHours: [12],
    },
    {
      kind: 'access',
      status: 'gate_closed',
      block: null,
      gate: 'portao-sfx',
      share: 0.25,
      notices: 6,
      minutesToEnd: null,
      peakHours: [18, 19],
    },
    {
      kind: 'restroom',
      status: 'no_water',
      block: 'A',
      gate: null,
      share: 0.15,
      notices: 4,
      minutesToEnd: 140,
      peakHours: [9],
    },
  ],
};
