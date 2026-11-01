import type { ClassOption, Interval, Subject } from './model.ts';

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
