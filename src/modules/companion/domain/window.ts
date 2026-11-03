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

/** O primeiro quarto de hora (:00, :15, :30, :45) a partir de `minute`. */
const quarterFrom = (minute: number) => Math.ceil(minute / 15) * 15;

/** Até `count` quartos de hora, de `first` até `until`. */
const quarters = (first: number, until: number, count: number) =>
  Array.from({ length: count }, (_, index) => first + index * 15).filter(
    option => option <= until,
  );

/** A mesa termina 40 minutos antes da próxima aula. */
const LUNCH_BEFORE_CLASS_MIN = 40;
/** Tempo para chegar ao ponto antes da primeira mesa oferecida. */
const LUNCH_LEAD_MIN = 10;

/**
 * Os horários que a folha de abrir oferece, em ms. A mesa: nos quartos de
 * hora (:00, :15, :30, :45), de 10 minutos a 2 horas daqui, terminando 40
 * minutos antes da próxima aula. Horários fixos fazem quem abre na mesma
 * hora cair na mesma mesa, em vez de 12:10 e 12:15. A volta: a partir do fim
 * da última aula do dia (ou de agora, se ela já acabou), de 5 em 5; quem sai
 * do mesmo bloco de aulas já sai na mesma hora.
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
    if (window.kind === 'class') {
      // em aula: a primeira mesa possível é depois dela
      const first = quarterFrom(window.current.end);
      const until =
        window.next !== null
          ? window.next.start - LUNCH_BEFORE_CLASS_MIN
          : first + 90;
      options = quarters(first, Math.max(until, first), 3);
    } else {
      const until =
        window.kind === 'free'
          ? window.next.start - LUNCH_BEFORE_CLASS_MIN
          : minute + 120;
      options = quarters(quarterFrom(minute + LUNCH_LEAD_MIN), until, 6);
      // a janela é curta para um quarto de hora: a mesa mais cedo possível
      if (!options.length) options = [base + 5];
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

/** O "Me avise" vale ao menos isso; menos que isso, não vale pedir. */
const WATCH_MIN_MIN = 15;
/** A volta ainda interessa até 40 minutos depois da última aula. */
const HOME_AFTER_CLASS_MIN = 40;

/**
 * Até quando o "Me avise se abrirem" vigia a lista, em ms, ou `null` se a
 * janela é curta demais. A mesa: até 40 minutos antes da próxima aula (ou 2
 * horas daqui, sem aula depois). A volta: até 40 minutos depois da última
 * aula do dia (ou 1 hora daqui, sem aula). Nunca passa da meia-noite.
 */
export function watchUntil(
  kind: CallKind,
  window: FreeWindow,
  now: Date,
): number | null {
  const minute = now.getHours() * 60 + now.getMinutes();
  let until: number;
  if (kind === 'lunch') {
    if (window.kind === 'free')
      until = window.next.start - LUNCH_BEFORE_CLASS_MIN;
    else if (window.kind === 'class')
      until =
        window.next !== null
          ? window.next.start - LUNCH_BEFORE_CLASS_MIN
          : window.current.end + 90;
    else until = minute + 120;
  } else if (window.kind === 'none') until = minute + 60;
  else
    until = Math.max(
      window.last.end + HOME_AFTER_CLASS_MIN,
      window.kind === 'done' ? minute + 60 : 0,
    );
  until = Math.min(until, 24 * 60 - 1);
  return until - minute >= WATCH_MIN_MIN ? atMinute(now, until) : null;
}

/**
 * Um horário digitado pelo aluno ("Outro horário"), em ms, ou por que não
 * vale: `past` (já passou ou é agora), `late` (passa de 3 horas daqui, o
 * limite do servidor, ou cai depois da meia-noite).
 */
export function customTime(
  now: Date,
  minute: number,
): { at: number } | { refused: 'past' | 'late' } {
  const at = atMinute(now, minute);
  if (at <= now.getTime()) return { refused: 'past' };
  if (at > now.getTime() + LEAD_MS - MINUTE) return { refused: 'late' };
  return { at };
}

/** O horário mais tarde que se pode digitar hoje, em minutos do dia. */
export function latestMinute(now: Date): number {
  const minute = now.getHours() * 60 + now.getMinutes();
  return Math.min(24 * 60 - 1, minute + LEAD_MS / MINUTE - 1);
}

/** A aula da grade que está acontecendo nesse horário de hoje, se houver. */
export function classAt(
  schedule: readonly AttendedClassesSchedule[],
  now: Date,
  minute: number,
): DayClass | null {
  return (
    classesOn(schedule, now).find(
      item => item.start <= minute && minute < item.end,
    ) ?? null
  );
}
