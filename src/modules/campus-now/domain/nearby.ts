import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import { parseLocation } from '@root/modules/campus-map/domain/parseLocation';
import {
  isLive,
  placeTypeOf,
  type CampusNotice,
  type NoticeBlock,
  type NoticeFloor,
  type NoticeKind,
  type NoticePlace,
  type NoticeStatus,
} from './campusNow';

/*
 * "Perto de você" sem GPS: onde a grade salva diz que o aluno está (a aula
 * de agora) ou vai estar logo (a próxima, se começa em até 40 minutos). Tudo
 * no aparelho; o servidor nunca recebe a grade.
 */

/**
 * Uma aula da semana numa sala do Pavilhão: o dia (0 é domingo), o horário
 * em minutos desde 00:00, a sala, o bloco e o andar. É o que fica guardado
 * para a verificação sem tela (sem o nome da disciplina).
 */
export type RoomClass = {
  weekday: number;
  start: number;
  end: number;
  /** O código da sala, como na grade ("6019"). */
  room: string;
  block: NoticeBlock;
  floor: NoticeFloor;
};

/** Uma aula de hoje, perto agora. */
export type ClassSpot = Omit<RoomClass, 'weekday'> & {
  /** Em aula agora (e não a caminho). */
  live: boolean;
};

/** Até quanto antes da aula o aluno conta como "a caminho". */
const SOON_MINUTES = 40;

const BLOCKS = new Set(['A', 'B', 'C', 'D', 'E', 'F']);

function timed(item: AttendedClassesSchedule): boolean {
  const { start_time_in_minutes: start, end_time_in_minutes: end } = item;
  return (
    item.class?.status !== 'CANCELED' &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start >= 0 &&
    end > start &&
    end <= 24 * 60
  );
}

/** A sala de uma aula no Pavilhão (os outros prédios não têm bloco). */
function roomOf(
  item: AttendedClassesSchedule,
): { room: string; block: NoticeBlock; floor: NoticeFloor } | null {
  const location = parseLocation(item.class?.uerjLocation);
  if (
    location.kind !== 'room' ||
    location.building !== 'pjlf' ||
    !location.block ||
    !BLOCKS.has(location.block)
  )
    return null;
  return { room: location.code, block: location.block, floor: location.floor };
}

/** As aulas da semana em salas do Pavilhão, na ordem do dia e da hora. */
export function roomClasses(
  schedule: readonly AttendedClassesSchedule[],
): RoomClass[] {
  return schedule
    .filter(timed)
    .map(item => {
      const room = roomOf(item);
      return room
        ? {
            weekday: item.dayNumber % 7,
            start: item.start_time_in_minutes,
            end: item.end_time_in_minutes,
            ...room,
          }
        : null;
    })
    .filter((item): item is RoomClass => item !== null)
    .sort(
      (a, b) => a.weekday - b.weekday || a.start - b.start || a.end - b.end,
    );
}

/**
 * Onde o aluno está ou vai estar: a aula de agora e a próxima que começa em
 * até 40 minutos, nessa ordem (no máximo uma de cada).
 */
export function spotsAt(classes: readonly RoomClass[], now: Date): ClassSpot[] {
  const weekday = now.getDay();
  const minute = now.getHours() * 60 + now.getMinutes();
  const today = classes
    .filter(item => item.weekday === weekday)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const current = today.find(item => item.start <= minute && minute < item.end);
  const next = today.find(
    item => item.start > minute && item.start - minute <= SOON_MINUTES,
  );
  const spot = (item: RoomClass, live: boolean): ClassSpot => ({
    start: item.start,
    end: item.end,
    room: item.room,
    block: item.block,
    floor: item.floor,
    live,
  });
  return [
    ...(current ? [spot(current, true)] : []),
    ...(next ? [spot(next, false)] : []),
  ];
}

/** `spotsAt` direto da grade salva. */
export const classSpots = (
  schedule: readonly AttendedClassesSchedule[],
  now: Date,
): ClassSpot[] => spotsAt(roomClasses(schedule), now);

const floorNumber = (floor: NoticeFloor) => {
  const value = Number(floor);
  return Number.isInteger(value) ? value : 0;
};

/**
 * Por que o aviso é do caminho do aluno: os elevadores (todos no hall do
 * bloco C) para quem tem aula do 3º andar para cima; o mesmo andar; a mesma
 * sala. Bandejão e portões não têm como sair da grade.
 */
export type NearReason = {
  spot: ClassSpot;
  reason: 'elevators' | 'floor' | 'room';
};

export function nearReason(
  notice: Pick<CampusNotice, 'place'>,
  spots: readonly ClassSpot[],
): NearReason | null {
  const { place } = notice;
  for (const spot of spots) {
    if (place.type === 'elevators' && floorNumber(spot.floor) >= 3)
      return { spot, reason: 'elevators' };
    if (
      place.type === 'floor' &&
      place.block === spot.block &&
      place.floor === spot.floor
    )
      return { spot, reason: 'floor' };
    if (
      place.type === 'room' &&
      place.block === spot.block &&
      place.room === spot.room
    )
      return { spot, reason: 'room' };
  }
  return null;
}

/**
 * A pergunta do momento ("ainda está lá?"): o aviso do caminho do aluno que
 * ele ainda não respondeu nem dispensou. Os confirmados primeiro, depois os
 * com mais confirmações e os mais novos. `confirmedOnly`: os avisos do
 * celular perguntam só dos que já valem para todos. `prefer`: os avisos de
 * que o celular já perguntou, do mais antigo ao mais recente; o mais recente
 * vem primeiro (quem toca no aviso encontra a mesma pergunta na tela).
 */
export function askTarget(
  notices: readonly CampusNotice[],
  spots: readonly ClassSpot[],
  {
    skipped,
    now,
    confirmedOnly = false,
    prefer = [],
  }: {
    skipped: readonly string[];
    now: number;
    confirmedOnly?: boolean;
    prefer?: readonly string[];
  },
): { notice: CampusNotice; near: NearReason } | null {
  const candidates = notices
    .filter(
      notice =>
        isLive(notice, now) &&
        !notice.mine &&
        !notice.answer &&
        !skipped.includes(notice.id) &&
        (!confirmedOnly || notice.confirmed),
    )
    .map(notice => ({ notice, near: nearReason(notice, spots) }))
    .filter(
      (item): item is { notice: CampusNotice; near: NearReason } =>
        item.near !== null,
    )
    .sort(
      (a, b) =>
        prefer.indexOf(b.notice.id) - prefer.indexOf(a.notice.id) ||
        Number(b.notice.confirmed) - Number(a.notice.confirmed) ||
        b.notice.confirmations - a.notice.confirmations ||
        b.notice.createdAt - a.notice.createdAt,
    );
  return candidates[0] ?? null;
}

/**
 * O lugar que a folha de avisar já traz: o hall e o bandejão são fixos; o
 * andar e a sala vêm da aula de agora ou da próxima. Sem aula por perto (ou
 * no portão), `null`: o aluno escolhe.
 */
export function suggestedPlace(
  kind: NoticeKind,
  status: NoticeStatus,
  spots: readonly ClassSpot[],
): NoticePlace | null {
  const type = placeTypeOf(kind, status);
  if (type === 'elevators') return { type: 'elevators' };
  if (type === 'ru') return { type: 'ru' };
  const spot = spots[0];
  if (!spot) return null;
  if (type === 'floor')
    return { type: 'floor', block: spot.block, floor: spot.floor };
  if (type === 'room')
    return {
      type: 'room',
      block: spot.block,
      floor: spot.floor,
      room: spot.room,
    };
  return null;
}

/**
 * O aluno deve estar no campus agora, pela grade: de 1 h antes da primeira
 * aula do dia até 30 min depois da última. O Início só busca os avisos aí.
 */
export function onCampusToday(
  schedule: readonly AttendedClassesSchedule[],
  now: Date,
  { before = 60, after = 30 }: { before?: number; after?: number } = {},
): boolean {
  const weekday = now.getDay();
  const minute = now.getHours() * 60 + now.getMinutes();
  const today = schedule.filter(
    item => item.dayNumber % 7 === weekday && timed(item),
  );
  if (!today.length) return false;
  const first = Math.min(...today.map(item => item.start_time_in_minutes));
  const last = Math.max(...today.map(item => item.end_time_in_minutes));
  return minute >= first - before && minute <= last + after;
}
