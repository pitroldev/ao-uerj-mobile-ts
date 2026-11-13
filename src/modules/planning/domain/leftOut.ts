import type { SubjectInfo } from '@root/modules/academics/domain/models';

import { leavesLunch, type LunchBreak } from './lunch';
import {
  classKey,
  type GeneratedClassWithSubject,
  type Schedule,
} from './models';
import { classBlock, hasScheduleConflict, scheduleIntervals } from './rules';

/**
 * Por que uma disciplina escolhida não está numa grade gerada:
 * - `ROUTINE`: nenhuma turma dela cabe na rotina: todas batem com um
 *   horário ocupado (`BUSY`), nenhuma deixa o almoço pedido (`LUNCH`) ou há
 *   das duas (`BOTH`);
 * - `REMOVED`: o aluno tirou as turmas que cabiam;
 * - `CLASH`: toda turma bate com alguma disciplina da grade (`with`);
 * - `LUNCH`: ela caberia, mas tiraria o horário de almoço de algum dia;
 * - `LIMIT`: ela cabe; ficou de fora pelo teto de disciplinas.
 */
export type LeftOut =
  | { kind: 'ROUTINE'; by: 'BUSY' | 'LUNCH' | 'BOTH'; classes: number }
  | { kind: 'REMOVED' }
  | { kind: 'CLASH'; with: string[] }
  | { kind: 'LUNCH' }
  | { kind: 'LIMIT' };

export function leftOutReason({
  subject,
  grade,
  busy,
  lunch,
  removed,
}: {
  /** A disciplina com as turmas lidas (ao menos uma). */
  subject: SubjectInfo;
  grade: readonly GeneratedClassWithSubject[];
  busy: readonly Schedule[];
  lunch?: LunchBreak | null;
  /** As turmas que o aluno tirou (`classKey`). */
  removed: ReadonlySet<string>;
}): LeftOut {
  const classes = subject.classes ?? [];
  const blocks = classes.map(group => classBlock(group, busy, lunch));
  const usable = classes.filter((_, index) => !blocks[index]);
  if (!usable.length) {
    const byBusy = blocks.some(block => block?.kind === 'BUSY');
    const byLunch = blocks.some(block => block?.kind === 'LUNCH');
    return {
      kind: 'ROUTINE',
      by: byBusy && byLunch ? 'BOTH' : byLunch ? 'LUNCH' : 'BUSY',
      classes: classes.length,
    };
  }
  const kept = usable.filter(
    group =>
      !removed.has(
        classKey({ subject_id: subject.id!, classNumber: group.classNumber }),
      ),
  );
  if (!kept.length) return { kind: 'REMOVED' };

  const gradeIntervals = grade.flatMap(item => item.schedules);
  let breaksLunch = false;
  let fewestClashes: string[] | null = null;
  for (const group of kept) {
    const intervals = scheduleIntervals(group.schedule ?? []);
    // o portal deixa cursar em choque quando uma das duas permite
    const clashing = grade
      .filter(
        item =>
          !subject.conflito &&
          !item.subject.allow_conflict &&
          hasScheduleConflict(intervals, item.schedules),
      )
      .map(item => item.name);
    if (clashing.length) {
      const names = [...new Set(clashing)];
      if (!fewestClashes || names.length < fewestClashes.length)
        fewestClashes = names;
      continue;
    }
    if (lunch && !leavesLunch([...gradeIntervals, ...intervals], lunch)) {
      breaksLunch = true;
      continue;
    }
    return { kind: 'LIMIT' };
  }
  if (breaksLunch) return { kind: 'LUNCH' };
  return { kind: 'CLASH', with: fewestClashes ?? [] };
}
