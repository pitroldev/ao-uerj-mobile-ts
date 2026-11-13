import type { ClassOption, Interval, LunchBreak, Subject } from './model.ts';

/*
 * A política de compatibilidade: quando uma turma cabe na agenda do aluno e
 * quando duas turmas cabem na mesma grade. São as regras do servidor antigo
 * com as correções que a produção roda.
 */

export const overlaps = (a: Interval, b: Interval): boolean =>
  a.day === b.day && a.start < b.end && b.start < a.end;

const anyOverlap = (a: readonly Interval[], b: readonly Interval[]) =>
  a.some(x => b.some(y => overlaps(x, y)));

/**
 * A turma não bate com nenhum horário em que o aluno não pode. Nem a
 * permissão de choque do portal passa por cima disso: é a vida do aluno.
 */
export const fitsAvailability = (
  option: ClassOption,
  busy: readonly Interval[],
): boolean => !anyOverlap(option.intervals, busy);

/** Uma turma com a disciplina dela. */
export type PlacedClass = { subject: Subject; intervals: Interval[] };

/**
 * Duas turmas cabem na mesma grade se são de disciplinas diferentes e não se
 * chocam, a não ser que uma das duas disciplinas permita o choque (nas duas
 * ordens; o servidor antigo só olhava uma).
 */
export function canShareSchedule(a: PlacedClass, b: PlacedClass): boolean {
  if (a.subject.id === b.subject.id) return false;
  if (a.subject.allowsConflict || b.subject.allowsConflict) return true;
  return !anyOverlap(a.intervals, b.intervals);
}

/*
 * O horário de almoço: um trecho contínuo livre dentro da janela, em cada dia
 * com aula. A regra é monótona — mais aulas só diminuem o trecho livre —, o
 * que deixa a busca podá-la como um choque.
 */

/** Os intervalos de um dia recortados à janela do almoço. */
export type LunchDay = { day: number; intervals: Interval[] };

/**
 * O maior trecho contínuo livre dentro de `[lunch.start, lunch.end)`, dados os
 * intervalos de um dia. Cada aula é recortada à janela (o que fica fora não
 * conta); as que se sobrepõem valem como um só trecho ocupado.
 */
export function freeWithinWindow(
  lunch: LunchBreak,
  intervals: readonly Interval[],
): number {
  const clipped: Array<{ start: number; end: number }> = [];
  for (const interval of intervals) {
    const start = Math.max(lunch.start, interval.start);
    const end = Math.min(lunch.end, interval.end);
    if (start < end) clipped.push({ start, end });
  }
  clipped.sort((a, b) => a.start - b.start);
  let cursor = lunch.start;
  let free = 0;
  for (const { start, end } of clipped) {
    if (start > cursor) free = Math.max(free, start - cursor);
    if (end > cursor) cursor = end;
  }
  return Math.max(free, lunch.end - cursor);
}

/** As aulas de cada dia recortadas à janela, só para os dias que a tocam. */
export function lunchDaysOf(
  lunch: LunchBreak,
  intervals: readonly Interval[],
): LunchDay[] {
  const byDay = new Map<number, Interval[]>();
  for (const interval of intervals) {
    const start = Math.max(lunch.start, interval.start);
    const end = Math.min(lunch.end, interval.end);
    if (start >= end) continue;
    const clipped: Interval = { day: interval.day, start, end };
    const bucket = byDay.get(interval.day);
    if (bucket) bucket.push(clipped);
    else byDay.set(interval.day, [clipped]);
  }
  return [...byDay].map(([day, items]) => ({ day, intervals: items }));
}

/**
 * A grade respeita o horário de almoço: em cada dia com aula, sobra um trecho
 * contínuo de pelo menos `lunch.minutes` dentro de `[lunch.start, lunch.end)`
 * sem nenhuma aula daquele dia. Dia sem aula na janela passa.
 */
export function respectsLunchBreak(
  classes: readonly PlacedClass[],
  lunch: LunchBreak,
): boolean {
  return lunchDaysOf(
    lunch,
    classes.flatMap(option => option.intervals),
  ).every(
    ({ intervals }) => freeWithinWindow(lunch, intervals) >= lunch.minutes,
  );
}
