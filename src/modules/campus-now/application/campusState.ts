import {
  NOTICE_BLOCKS,
  NOTICE_KINDS,
  NOTICE_STATUSES,
  type NoticeKind,
  type NoticeStatus,
} from '../domain/campusNow';
import type { RoomClass } from '../domain/nearby';

/** A preferência da conta (o logout apaga). */
export const CAMPUS_STATE_KEY = 'campus-now';

/** Um aviso de hoje do próprio aluno e o que o celular já disse dele. */
export type OwnNotice = {
  id: string;
  kind: NoticeKind;
  status: NoticeStatus;
  createdAt: number;
  /** O último número visto (o aviso de "valeu" sai quando o aviso acaba). */
  thanks: number;
  views: number;
  /** O "Seu aviso foi confirmado" já saiu. */
  confirmedTold: boolean;
  /** Acabou, e o celular já disse o que tinha a dizer. */
  done: boolean;
};

/**
 * O que o aparelho guarda do Agora no campus, por conta: as salas da grade
 * (para a verificação sem tela, que não entra no portal), o que o aluno
 * dispensou ou já ouviu hoje, os avisos dele de hoje e o último nível.
 */
export type CampusState = {
  /** O dia das listas de hoje (AAAA-MM-DD, no aparelho). */
  day: string;
  /** O aluno já abriu o Agora no campus: só então o celular pergunta. */
  visited: boolean;
  classes: RoomClass[];
  /** "Não vou passar por lá". */
  skipped: string[];
  /** Os avisos de que o celular já perguntou "ainda está lá?" hoje. */
  asked: string[];
  own: OwnNotice[];
  /** O último nível conhecido (`null` antes da primeira leitura). */
  level: number | null;
};

const pad = (value: number) => String(value).padStart(2, '0');

/** AAAA-MM-DD no fuso do aparelho. */
export function dayKey(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const strings = (value: unknown, max: number): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .slice(-max)
    : [];

const integer = (value: unknown, min: number, max: number) =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max;

function roomClass(raw: unknown): RoomClass | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (
    !integer(value.weekday, 0, 6) ||
    !integer(value.start, 0, 24 * 60) ||
    !integer(value.end, 0, 24 * 60) ||
    typeof value.room !== 'string' ||
    typeof value.floor !== 'string' ||
    !NOTICE_BLOCKS.includes(value.block as RoomClass['block'])
  )
    return null;
  return {
    weekday: value.weekday as number,
    start: value.start as number,
    end: value.end as number,
    room: value.room,
    block: value.block as RoomClass['block'],
    floor: value.floor,
  };
}

function ownNotice(raw: unknown): OwnNotice | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (
    typeof value.id !== 'string' ||
    !NOTICE_KINDS.includes(value.kind as NoticeKind) ||
    !NOTICE_STATUSES.includes(value.status as NoticeStatus) ||
    typeof value.createdAt !== 'number'
  )
    return null;
  return {
    id: value.id,
    kind: value.kind as NoticeKind,
    status: value.status as NoticeStatus,
    createdAt: value.createdAt,
    thanks: integer(value.thanks, 0, 1e6) ? (value.thanks as number) : 0,
    views: integer(value.views, 0, 1e7) ? (value.views as number) : 0,
    confirmedTold: value.confirmedTold === true,
    done: value.done === true,
  };
}

/**
 * A cópia salva, sem confiar no formato. Num dia novo, as listas de hoje
 * recomeçam; as salas, a visita e o nível continuam.
 */
export function normalizeCampusState(raw: unknown, now: number): CampusState {
  const value =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const today = dayKey(now);
  const sameDay = value.day === today;
  const classes = Array.isArray(value.classes)
    ? value.classes
        .map(roomClass)
        .filter((item): item is RoomClass => item !== null)
        .slice(0, 80)
    : [];
  return {
    day: today,
    visited: value.visited === true,
    classes,
    skipped: sameDay ? strings(value.skipped, 100) : [],
    asked: sameDay ? strings(value.asked, 100) : [],
    own:
      sameDay && Array.isArray(value.own)
        ? value.own
            .map(ownNotice)
            .filter((item): item is OwnNotice => item !== null)
            .slice(-20)
        : [],
    level: integer(value.level, 1, 99) ? (value.level as number) : null,
  };
}
