import type { PushDevice } from '../../shared/push.ts';
import {
  saoPaulo,
  type Gate,
  type Notice,
  type NoticeKind,
  type NoticeStatus,
  type Place,
} from './domain.ts';

/*
 * O Agora no campus em segundo plano no iPhone, que não roda nada a cada 15
 * minutos como o Android. O servidor sabe quem avisou: o aviso confirmado,
 * quantos agradeceram e o nível novo chegam por push com o alerta, nas
 * palavras do app. O "ainda está lá?" depende do caminho do aluno (a grade),
 * que fica só no celular: o servidor só acorda o app com um push silencioso,
 * e o celular decide.
 */

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** O aparelho registrado vale 30 dias; o app registra de novo a cada abertura. */
export const PUSH_DEVICE_TTL_MS = 30 * DAY;
/** Um aparelho é acordado no máximo a cada meia hora (a Apple segura mais que isso). */
export const WAKE_INTERVAL_MS = 30 * MINUTE;
/** O silencioso que não chegou nisso já não serve. */
export const WAKE_EXPIRY_MS = 15 * MINUTE;
/** O aviso do aviso confirmado e o do nível: até duas horas sem sinal. */
export const ALERT_EXPIRY_MS = 2 * 60 * MINUTE;
/** Quantos agradeceram: depois de 12 horas sem sinal, não serve mais. */
export const THANKS_EXPIRY_MS = 12 * 60 * MINUTE;
/**
 * A rodada olha os avisos que acabaram há até uma hora: os de antes (o
 * servidor fora, a primeira subida) ficam sem o "quantos agradeceram".
 */
export const THANKS_LOOKBACK_MS = 60 * MINUTE;
/** Das 22h às 7h, nenhum push (o celular também não pergunta à noite). */
export const QUIET_START_HOUR = 22;
export const QUIET_END_HOUR = 7;

/** Das 22h às 7h de São Paulo. */
export function isQuietTime(now: Date): boolean {
  const { hour } = saoPaulo(now);
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

/** O iPhone do aluno, para os avisos do Agora no campus. */
export type CampusPushDevice = {
  student: string;
  device: PushDevice;
  updatedAt: Date;
  /** O índice TTL apaga aqui (o registro da próxima abertura empurra). */
  expiresAt: Date;
  /** O último push silencioso (`null`: nunca). */
  wokenAt: Date | null;
};

/** O que o push mostra: o título e o texto. */
export type AlertText = { title: string; body: string };

/* ------------------------------------------- as palavras do app (iguais) */

/*
 * Os textos de src/modules/campus-now/presentation/campusNowText.ts, no app:
 * o push do iPhone diz o mesmo que o aviso do Android. O admin tem os
 * próprios rótulos (curtos, sem a rua do portão), que não mudam com estes.
 */

const NOTICE_TITLE: Readonly<
  Record<NoticeKind, Partial<Record<NoticeStatus, string>>>
> = {
  elevators: {
    short_queue: 'Elevadores: fila pequena',
    long_queue: 'Elevadores: fila de 10 min ou mais',
    stopped: 'Elevadores parados',
  },
  ru: {
    short_queue: 'Fila pequena no bandejão',
    long_queue: 'Fila grande no bandejão',
    closed: 'Bandejão fechado',
  },
  power: {
    no_power: 'Sem luz',
    no_ac: 'Sem ar-condicionado',
    no_outlets: 'Tomadas sem energia',
  },
  internet: { wifi_down: 'Wi-Fi fora', wifi_slow: 'Wi-Fi lento' },
  restroom: {
    no_water: 'Banheiro sem água',
    closed: 'Banheiro interditado',
    no_paper: 'Banheiro sem papel',
  },
  access: {
    gate_closed: 'Portão fechado',
    ramp_closed: 'Rampa interditada',
    room_locked: 'Sala trancada',
  },
};

/** "Elevadores: fila de 10 min ou mais", "Banheiro sem água". */
export const noticeTitle = (notice: Pick<Notice, 'kind' | 'status'>) =>
  NOTICE_TITLE[notice.kind][notice.status] ?? 'Aviso no campus';

/** Os portões do atlas: o número e a rua. */
const GATE_TEXT: Readonly<Record<Gate, { name: string; street: string }>> = {
  'portao-metro': { name: 'Portão 1', street: 'Radial Oeste, do metrô' },
  'portao-leste': { name: 'Portão 3', street: 'Av. Prof. Manoel de Abreu' },
  'portao-sudeste': { name: 'Portão 4', street: 'R. Radialista Waldir Amaral' },
  'portao-sfx': { name: 'Portão 5', street: 'R. São Francisco Xavier, 524' },
  'portao-oeste': { name: 'Portão 6', street: 'R. São Francisco Xavier' },
  'portao-radial': { name: 'Portão 7', street: 'Radial Oeste' },
};

/** "6º andar", "térreo", "semienterrado" (como o Mapa do app chama). */
const floorText = (floor: string) =>
  floor === 'T'
    ? 'térreo'
    : floor === 'SE'
      ? 'semienterrado'
      : `${floor}º andar`;

/** "Hall dos elevadores, bloco C", "Bloco B, 6º andar", "Sala 6019, bloco B". */
export function placeText(place: Place): string {
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

const count = (value: number) => value.toLocaleString('pt-BR');
const colleagues = (value: number) =>
  `${count(value)} ${value === 1 ? 'colega' : 'colegas'}`;
const plural = (value: number, one: string, many: string) =>
  `${count(value)} ${value === 1 ? one : many}`;

const CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Sao_Paulo',
  hour: 'numeric',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** "9:05", "14:30": a hora de São Paulo, sem o zero da hora, como no app. */
export function clockText(date: Date): string {
  const parts = Object.fromEntries(
    CLOCK.formatToParts(date).map(part => [part.type, part.value]),
  );
  return `${Number(parts.hour) % 24}:${parts.minute}`;
}

const LEVEL_NAMES = [
  'Chegando',
  'Na área',
  'Olho no campus',
  'Guia do campus',
  'Lenda do Pavilhão',
] as const;

export const levelName = (level: number) =>
  LEVEL_NAMES[Math.min(LEVEL_NAMES.length, Math.max(1, level)) - 1];

/** O aviso do aluno ganhou a primeira confirmação. */
export function confirmedText(
  notice: Pick<Notice, 'kind' | 'status' | 'place'>,
): AlertText {
  return {
    title: 'Seu aviso foi confirmado',
    body: `${noticeTitle(notice)}: ${placeText(notice.place)}. Agora vale para todo mundo.`,
  };
}

/** O aviso do aluno acabou, e colegas agradeceram. */
export function thanksText(
  notice: Pick<Notice, 'kind' | 'status' | 'createdAt' | 'thanks' | 'views'>,
): AlertText {
  return {
    title: `${colleagues(notice.thanks)} ${notice.thanks === 1 ? 'agradeceu' : 'agradeceram'} seu aviso`,
    body: `${noticeTitle(notice)}, às ${clockText(notice.createdAt)}. ${plural(notice.views, 'pessoa viu', 'pessoas viram')} antes de ir.`,
  };
}

/** O nível subiu. */
export function levelText(level: number): AlertText {
  return {
    title: `Nível ${level}: ${levelName(level)}`,
    body:
      level === 3
        ? 'Seus avisos agora valem direto, sem esperar confirmação. Valeu por cuidar do campus.'
        : 'Valeu por cuidar do campus.',
  };
}
