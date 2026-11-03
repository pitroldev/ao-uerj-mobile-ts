import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import { LEAD_MS, type CallKind } from './companion';

/*
 * A janela de cada um sai da grade salva, no aparelho: o servidor recebe só
 * o horário da chamada. Livre até a próxima aula, em aula até tal hora ou a
 * última aula do dia que já acabou.
 */

/** Uma aula do dia, em minutos desde 00:00. */
type DayClass = { name: string; room: string; start: number; end: number };

export type FreeWindow =
  | { kind: 'class'; current: DayClass; next: DayClass | null; last: DayClass }
  | { kind: 'free'; next: DayClass; last: DayClass }
  | { kind: 'done'; last: DayClass }
  | { kind: 'none' };

const MINUTE = 60 * 1000;

/** Aula com horário que vale (sem os "??" do portal) e não cancelada. */
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

/** As aulas de hoje, pela hora de início. */
function classesOn(
  schedule: readonly AttendedClassesSchedule[],
  date: Date,
): DayClass[] {
  const weekday = date.getDay();
  return schedule
    .filter(item => item.dayNumber % 7 === weekday && timed(item))
    .map(item => ({
      name: item.class?.name ?? item.subject_id,
      room: item.class?.uerjLocation ?? '',
      start: item.start_time_in_minutes,
      end: item.end_time_in_minutes,
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Onde o aluno está no dia agora, pela grade. */
export function freeWindow(
  schedule: readonly AttendedClassesSchedule[],
  now: Date,
): FreeWindow {
  const day = classesOn(schedule, now);
  if (!day.length) return { kind: 'none' };
  const minute = now.getHours() * 60 + now.getMinutes();
  const last = day.reduce((latest, item) =>
    item.end > latest.end ? item : latest,
  );
  const current = day
    .filter(item => item.start <= minute && minute < item.end)
    .sort((a, b) => b.end - a.end)[0];
  const next = day.find(item => item.start > minute) ?? null;
  if (current) return { kind: 'class', current, next, last };
  if (next) return { kind: 'free', next, last };
  return { kind: 'done', last };
}

/** Os minutos do dia de `now` em ms. */
const atMinute = (now: Date, minute: number) =>
  new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    Math.floor(minute / 60),
    minute % 60,
  ).getTime();

/** O primeiro múltiplo de 5 minutos depois de `minute`. */
const nextFive = (minute: number) => Math.floor(minute / 5) * 5 + 5;

/** A mesa termina 40 minutos antes da próxima aula. */
const LUNCH_BEFORE_CLASS_MIN = 40;

/**
 * Os horários que a folha de abrir oferece, em ms. A mesa: de 10 minutos a
 * 1h30 daqui, terminando 40 minutos antes da próxima aula. A volta: a partir
 * do fim da última aula do dia (ou de agora, se ela já acabou), de 5 em 5.
 */
export function timeOptions(
  kind: CallKind,
  window: FreeWindow,
  now: Date,
): number[] {
  const minute = now.getHours() * 60 + now.getMinutes();
  const base = nextFive(minute);
  const lastOfDay = 24 * 60 - 5;
  let options: number[];
  if (kind === 'lunch') {
    const limit =
      window.kind === 'free'
        ? window.next.start - LUNCH_BEFORE_CLASS_MIN
        : window.kind === 'class'
          ? -1
          : minute + 120;
    options = [5, 15, 25, 40, 55, 85]
      .map(lead => base + lead)
      .filter(option => option <= limit);
    if (!options.length && window.kind !== 'class') options = [base + 5];
    if (window.kind === 'class') {
      // em aula: a primeira mesa possível é depois dela
      const after = nextFive(window.current.end - 1);
      const until =
        window.next !== null
          ? window.next.start - LUNCH_BEFORE_CLASS_MIN
          : after + 90;
      options = [0, 15, 30]
        .map(lead => after + lead)
        .filter(option => option <= Math.max(until, after));
    }
  } else {
    const anchor =
      window.kind === 'done' || window.kind === 'none'
        ? base
        : Math.max(base, nextFive(window.last.end - 1));
    options = [0, 5, 10, 15, 25].map(lead => anchor + lead);
  }
  const latest = now.getTime() + LEAD_MS - MINUTE;
  return [...new Set(options)]
    .filter(option => option <= lastOfDay)
    .map(option => atMinute(now, option))
    .filter(at => at > now.getTime() && at <= latest);
}
