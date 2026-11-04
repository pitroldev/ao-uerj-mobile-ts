import type { IconName } from '@components/ui/Icon/glyphs';
import { floorLabel } from '@root/modules/campus-map/domain/parseLocation';
import type { Floor } from '@root/modules/campus-map/domain/types';
import { AppError, errorMessage } from '@root/shared/errors/AppError';
import {
  CampusNowError,
  ENDS_TO_CLOSE,
  type CampusNotice,
  type CampusProblem,
  type CommunitySummary,
  type NoticeFloor,
  type NoticeGate,
  type NoticeKind,
  type NoticePlace,
  type NoticeStatus,
} from '../domain/campusNow';
import type { NearReason } from '../domain/nearby';
import type { BadgeId } from '../domain/progress';
import type { CampusNotification } from '../application/ports';

/*
 * As palavras do Agora no campus, como um aluno falaria: "avisar", "continua",
 * "acabou", "valeu", "bandejão". Nada de termos internos ("notice",
 * "relato", "ocorrência").
 */

const FEATURE_TITLE = 'Agora no campus';

export const KIND_TEXT: Readonly<
  Record<NoticeKind, { label: string; icon: IconName }>
> = {
  elevators: { label: 'Elevadores', icon: 'elevator' },
  ru: { label: 'Bandejão', icon: 'restaurant' },
  power: { label: 'Luz e ar', icon: 'bolt' },
  internet: { label: 'Internet', icon: 'wifi_off' },
  restroom: { label: 'Banheiros', icon: 'water_drop' },
  access: { label: 'Acesso', icon: 'door_front' },
};

type StatusText = {
  /** O botão na folha de avisar. */
  option: string;
  /** O título na lista. */
  title: string;
  /** A pergunta de "ainda está lá?". */
  ask: string;
};

const STATUS_TEXT: Readonly<
  Record<NoticeKind, Partial<Record<NoticeStatus, StatusText>>>
> = {
  elevators: {
    short_queue: {
      option: 'Fila pequena, uns 5 min',
      title: 'Elevadores: fila pequena',
      ask: 'Os elevadores ainda estão com fila?',
    },
    long_queue: {
      option: 'Fila de 10 min ou mais',
      title: 'Elevadores: fila de 10 min ou mais',
      ask: 'Os elevadores ainda estão com fila grande?',
    },
    stopped: {
      option: 'Todos parados',
      title: 'Elevadores parados',
      ask: 'Os elevadores ainda estão parados?',
    },
  },
  ru: {
    short_queue: {
      option: 'Fila pequena',
      title: 'Fila pequena no bandejão',
      ask: 'A fila do bandejão ainda está pequena?',
    },
    long_queue: {
      option: 'Fila grande',
      title: 'Fila grande no bandejão',
      ask: 'A fila do bandejão ainda está grande?',
    },
    closed: {
      option: 'Fechado',
      title: 'Bandejão fechado',
      ask: 'O bandejão ainda está fechado?',
    },
  },
  power: {
    no_power: {
      option: 'Sem luz',
      title: 'Sem luz',
      ask: 'Ainda está sem luz?',
    },
    no_ac: {
      option: 'Sem ar-condicionado',
      title: 'Sem ar-condicionado',
      ask: 'Ainda está sem ar-condicionado?',
    },
    no_outlets: {
      option: 'Tomadas sem energia',
      title: 'Tomadas sem energia',
      ask: 'As tomadas ainda estão sem energia?',
    },
  },
  internet: {
    wifi_down: {
      option: 'Wi-Fi fora',
      title: 'Wi-Fi fora',
      ask: 'O Wi-Fi ainda está fora?',
    },
    wifi_slow: {
      option: 'Wi-Fi lento',
      title: 'Wi-Fi lento',
      ask: 'O Wi-Fi ainda está lento?',
    },
  },
  restroom: {
    no_water: {
      option: 'Sem água',
      title: 'Banheiro sem água',
      ask: 'O banheiro ainda está sem água?',
    },
    closed: {
      option: 'Interditado',
      title: 'Banheiro interditado',
      ask: 'O banheiro ainda está interditado?',
    },
    no_paper: {
      option: 'Sem papel',
      title: 'Banheiro sem papel',
      ask: 'O banheiro ainda está sem papel?',
    },
  },
  access: {
    gate_closed: {
      option: 'Portão fechado',
      title: 'Portão fechado',
      ask: 'O portão ainda está fechado?',
    },
    ramp_closed: {
      option: 'Rampa interditada',
      title: 'Rampa interditada',
      ask: 'A rampa ainda está interditada?',
    },
    room_locked: {
      option: 'Sala trancada',
      title: 'Sala trancada',
      ask: 'A sala ainda está trancada?',
    },
  },
};

const FALLBACK: StatusText = {
  option: 'Aviso',
  title: 'Aviso no campus',
  ask: 'Ainda está assim?',
};

const statusText = (kind: NoticeKind, status: NoticeStatus): StatusText =>
  STATUS_TEXT[kind][status] ?? FALLBACK;

export const optionText = (kind: NoticeKind, status: NoticeStatus) =>
  statusText(kind, status).option;

/** "Elevadores: fila de 10 min ou mais", "Banheiro sem água". */
export const noticeTitle = (notice: Pick<CampusNotice, 'kind' | 'status'>) =>
  statusText(notice.kind, notice.status).title;

/** "Os elevadores ainda estão com fila?" */
export const askText = (notice: Pick<CampusNotice, 'kind' | 'status'>) =>
  statusText(notice.kind, notice.status).ask;

/** Os portões do atlas: o número e a rua. */
export const GATE_TEXT: Readonly<
  Record<NoticeGate, { name: string; street: string }>
> = {
  'portao-metro': { name: 'Portão 1', street: 'Radial Oeste, do metrô' },
  'portao-leste': { name: 'Portão 3', street: 'Av. Prof. Manoel de Abreu' },
  'portao-sudeste': { name: 'Portão 4', street: 'R. Radialista Waldir Amaral' },
  'portao-sfx': { name: 'Portão 5', street: 'R. São Francisco Xavier, 524' },
  'portao-oeste': { name: 'Portão 6', street: 'R. São Francisco Xavier' },
  'portao-radial': { name: 'Portão 7', street: 'Radial Oeste' },
};

/** "6º andar", "térreo", "semienterrado" (como o Mapa chama). */
export function floorText(floor: NoticeFloor): string {
  const label = floorLabel(floor as Floor);
  return floor === 'T' || floor === 'SE' ? label.toLowerCase() : label;
}

/** "Hall dos elevadores, bloco C", "Bloco B, 6º andar", "Sala 6019, bloco B". */
export function placeText(place: NoticePlace): string {
  switch (place.type) {
    case 'elevators':
      return 'Hall dos elevadores, bloco C';
    case 'ru':
      return 'Bandejão (Restaurante Universitário)';
    case 'gate':
      return `${GATE_TEXT[place.gate].name}, ${GATE_TEXT[place.gate].street}`;
    case 'floor':
      return `Bloco ${place.block}, ${floorText(place.floor)}`;
    case 'room':
      return `Sala ${place.room}, bloco ${place.block}`;
  }
}

/** Um lugar curto, para o mapa e o aviso do celular. */
export function shortPlaceText(place: NoticePlace): string {
  switch (place.type) {
    case 'elevators':
      return 'hall do C';
    case 'ru':
      return 'bandejão';
    case 'gate':
      return GATE_TEXT[place.gate].name;
    case 'floor':
      return `${place.block}, ${floorText(place.floor)}`;
    case 'room':
      return `Sala ${place.room} ${place.block}`;
  }
}

/** Para "Ver no Mapa": um lugar do atlas ou uma sala que o Mapa encontra. */
export function mapTarget(
  place: NoticePlace,
): { place: string } | { location: string } {
  switch (place.type) {
    case 'elevators':
      return { place: 'bloco-c' };
    case 'ru':
      return { place: 'ru' };
    case 'gate':
      return { place: place.gate };
    case 'floor':
      return { place: `bloco-${place.block.toLowerCase()}` };
    case 'room':
      return { location: `${place.room} ${place.block}` };
  }
}

const pad = (value: number) => String(value).padStart(2, '0');

/** "14:20", a partir de minutos desde 00:00. */
export const minuteText = (minute: number) =>
  `${Math.floor(minute / 60)}:${pad(minute % 60)}`;

/** "14:20", a partir de ms. */
export function clockText(ms: number): string {
  const date = new Date(ms);
  return `${date.getHours()}:${pad(date.getMinutes())}`;
}

/** "agora há pouco", "há 12 min", "há 1h20", "desde 9:10" (mais de 3 h). */
export function sinceText(at: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - at) / 60000));
  if (minutes < 1) return 'agora há pouco';
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes >= 180) return `desde ${clockText(at)}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `há ${hours}h${rest ? pad(rest) : ''}`;
}

/** "1 colega", "12 colegas". */
export const colleagues = (count: number) =>
  `${count.toLocaleString('pt-BR')} ${count === 1 ? 'colega' : 'colegas'}`;

const plural = (count: number, one: string, many: string) =>
  `${count.toLocaleString('pt-BR')} ${count === 1 ? one : many}`;

/** Por que o aviso é do caminho do aluno, pela grade. */
export function nearText(near: NearReason): string {
  const { spot, reason } = near;
  const when = spot.live
    ? `sua aula, que vai até ${minuteText(spot.end)}`
    : `sua aula das ${minuteText(spot.start)}`;
  if (reason === 'elevators')
    return spot.live
      ? `Você está em aula no ${floorText(spot.floor)} do bloco ${spot.block} até ${minuteText(spot.end)}.`
      : `Você tem aula no ${floorText(spot.floor)} do bloco ${spot.block} às ${minuteText(spot.start)}.`;
  if (reason === 'room') return `É a sala da ${when}.`;
  return `É o andar da ${when}, na Sala ${spot.room} ${spot.block}.`;
}

/**
 * A linha de estado de um aviso: "8 confirmaram · há 29 min", "novo ·
 * esperando confirmação · há 4 min" ou, no do aluno, "seu aviso · 37 viram ·
 * 12 valeus".
 */
export function stateText(notice: CampusNotice, now: number): string {
  const since = sinceText(notice.createdAt, now);
  const ends =
    notice.ends > 0
      ? ` · ${notice.ends} de ${ENDS_TO_CLOSE} disseram que acabou`
      : '';
  if (notice.mine) {
    const seen = plural(notice.views ?? 0, 'viu', 'viram');
    const thanks = plural(notice.thanks ?? 0, 'valeu', 'valeus');
    const waiting = notice.confirmed ? '' : ' · esperando confirmação';
    return `seu aviso · ${seen} · ${thanks}${waiting}${ends}`;
  }
  if (!notice.confirmed)
    return `novo · esperando confirmação · ${since}${ends}`;
  if (notice.confirmations === 0)
    return `vale pelo nível de quem avisou · ${since}${ends}`;
  return `${plural(notice.confirmations, 'confirmou', 'confirmaram')} · ${since}${ends}`;
}

/** O estado de um aviso de hoje do aluno, que já pode ter acabado. */
export function outcomeText(notice: CampusNotice, now: number): string {
  if (notice.state === 'active' && notice.expiresAt > now)
    return stateText(notice, now);
  const seen = plural(notice.views ?? 0, 'viu', 'viram');
  const thanks = plural(notice.thanks ?? 0, 'valeu', 'valeus');
  if (notice.state === 'removed')
    return `saiu do ar: colegas disseram que não era verdade · ${seen}`;
  const end = notice.state === 'ended' ? 'acabou' : 'sumiu sozinho';
  return `${end} · ${seen} · ${thanks}`;
}

/** Os nomes dos níveis, do 1 ao 5. */
const LEVEL_NAMES = [
  'Chegando',
  'Na área',
  'Olho no campus',
  'Guia do campus',
  'Lenda do Pavilhão',
] as const;

export const levelName = (level: number) =>
  LEVEL_NAMES[Math.min(LEVEL_NAMES.length, Math.max(1, level)) - 1];

/** "Nível 2 · Na área". */
export const levelText = (level: number) =>
  `Nível ${level} · ${levelName(level)}`;

/** "+10 pontos". */
export const pointsText = (points: number) =>
  `${points > 0 ? '+' : ''}${plural(points, 'ponto', 'pontos')}`;

/** Como ganhar pontos, na tela "Você ajudou". */
export const POINT_RULES: readonly { label: string; points: number }[] = [
  { label: 'Avisar', points: 10 },
  { label: 'Seu aviso confirmado', points: 5 },
  { label: 'Confirmar ou dizer que acabou', points: 3 },
  { label: 'Cada valeu recebido', points: 1 },
];

export const BADGE_TEXT: Readonly<
  Record<BadgeId, { name: string; text: string; icon: IconName }>
> = {
  first: {
    name: 'Primeiro aviso',
    text: 'Avisou pela primeira vez',
    icon: 'campaign',
  },
  checker: {
    name: 'Conferente',
    text: '25 respostas de "continua" ou "acabou"',
    icon: 'thumb_up',
  },
  helped: {
    name: 'Ajudou 100',
    text: '100 vezes que alguém viu um aviso seu',
    icon: 'groups',
  },
  trusted: {
    name: 'Olho no campus',
    text: 'Nível 3: seus avisos valem direto',
    icon: 'verified',
  },
};

/** O que a recusa ou o erro quer dizer, para o snackbar. */
export function campusNowErrorMessage(error: unknown): string {
  if (error instanceof CampusNowError) {
    switch (error.refusal) {
      case 'gone':
        return 'Esse aviso já acabou ou saiu do ar.';
      case 'own':
        return 'Esse aviso é seu.';
      case 'answered':
        return 'Você já respondeu esse aviso.';
      case 'place':
        return 'Esse lugar não serve para esse aviso. Escolha outro.';
      case 'limit':
        return 'Você chegou a 10 avisos hoje, o limite do dia. Amanhã dá para avisar de novo.';
      case 'full':
        return 'O campus está com avisos demais agora. Tente de novo em alguns minutos.';
    }
  }
  if (error instanceof AppError && error.code === 'STUDENT_PROOF_UNAVAILABLE')
    return 'Não deu para confirmar que você é aluno agora. Com a internet ligada, tente de novo em alguns segundos.';
  return errorMessage(error);
}

/* ---------------------------------------------------------- comunidade */

/** "bloco A", "Portão 5"; o hall e o bandejão já dizem onde. */
function areaText(problem: CampusProblem): string | null {
  if (problem.gate) return GATE_TEXT[problem.gate].name;
  if (problem.block) return `bloco ${problem.block}`;
  return null;
}

/** "Wi-Fi fora · bloco A". */
export function problemTitle(problem: CampusProblem): string {
  const area = areaText(problem);
  const title = noticeTitle(problem);
  return area ? `${title} · ${area}` : title;
}

/** "2h50", "38 min". */
export function durationText(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `${hours}h${rest ? pad(rest) : ''}`;
}

/** "às 7h e às 13h", na ordem do dia. */
function peakText(hours: readonly number[]): string | null {
  if (!hours.length) return null;
  return [...hours]
    .sort((a, b) => a - b)
    .map(hour => `às ${hour}h`)
    .join(' e ');
}

/** "2h50 em média até acabar · mais comum às 7h e às 13h". */
export function problemText(problem: CampusProblem): string {
  const parts: string[] = [];
  if (problem.minutesToEnd !== null)
    parts.push(`${durationText(problem.minutesToEnd)} em média até acabar`);
  const peak = peakText(problem.peakHours);
  if (peak) parts.push(`mais comum ${peak}`);
  if (!parts.length)
    parts.push(
      plural(problem.notices, 'aviso confirmado', 'avisos confirmados'),
    );
  const text = parts.join(' · ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** "Novembro" a partir de "2026-11". */
export function monthName(month: string): string {
  const index = Number(month.split('-')[1]) - 1;
  const name = MONTHS[index] ?? month;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** O resumo do mês em texto, pronto para o grupo do CA. */
export function communityShareText(
  summary: CommunitySummary,
  { current }: { current: boolean },
): string {
  const { month } = summary;
  const name = monthName(month.month);
  const lines = [
    `Agora no campus · ${name}${current ? ', até hoje' : ''}`,
    `${plural(month.weekdays, 'dia útil', 'dias úteis')} · ${plural(month.notices, 'aviso confirmado', 'avisos confirmados')} pelos alunos`,
    '',
    ...month.problems.map(problem => {
      const peak = peakText(problem.peakHours);
      return `• ${problemTitle(problem)}: em ${problem.days} de ${month.weekdays} dias${peak ? `, mais comum ${peak}` : ''}`;
    }),
    '',
    'Avisos dos próprios alunos no app AO UERJ, somados, sem ninguém identificado.',
  ];
  return lines.join('\n');
}

/* ---------------------------------------------------- avisos do celular */

const notification = (
  id: string,
  title: string,
  body: string,
): CampusNotification => ({
  id,
  channel: 'campus',
  title,
  body,
  publicTitle: FEATURE_TITLE,
  publicBody: 'Há um aviso para você no Agora no campus.',
  target: 'campus',
});

/** "Os elevadores ainda estão com fila?", para quem vai passar por lá. */
export function askNotification(
  notice: CampusNotice,
  near: NearReason,
): CampusNotification {
  const who =
    notice.confirmations > 0
      ? ` ${colleagues(notice.confirmations + 1)} avisaram: ${shortPlaceText(notice.place)}.`
      : ` Aviso no ${shortPlaceText(notice.place)}.`;
  return notification(
    `campus-ask-${notice.id}`,
    askText(notice),
    `${nearText(near)}${who} Toque para responder.`,
  );
}

/** O aviso do aluno ganhou a primeira confirmação. */
export function confirmedNotification(
  notice: CampusNotice,
): CampusNotification {
  return notification(
    `campus-confirmed-${notice.id}`,
    'Seu aviso foi confirmado',
    `${noticeTitle(notice)}: ${placeText(notice.place)}. Agora vale para todo mundo.`,
  );
}

/** O aviso do aluno acabou, e colegas agradeceram. */
export function thanksNotification(
  notice: Pick<CampusNotice, 'id' | 'kind' | 'status' | 'createdAt'>,
  thanks: number,
  views: number,
): CampusNotification {
  return notification(
    `campus-thanks-${notice.id}`,
    `${colleagues(thanks)} ${thanks === 1 ? 'agradeceu' : 'agradeceram'} seu aviso`,
    `${noticeTitle(notice)}, às ${clockText(notice.createdAt)}. ${plural(views, 'pessoa viu', 'pessoas viram')} antes de ir.`,
  );
}

/** O nível subiu. */
export function levelNotification(level: number): CampusNotification {
  return notification(
    `campus-level-${level}`,
    `Nível ${level}: ${levelName(level)}`,
    level === 3
      ? 'Seus avisos agora valem direto, sem esperar confirmação. Valeu por cuidar do campus.'
      : 'Valeu por cuidar do campus.',
  );
}
