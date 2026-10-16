import type { CurriculumSubject, SubjectsTaken } from '../models';
import { normalizeSubjectId } from './subjectId';

/** The portal's numeric subject code is also the details/cache identity. */
export function completedSubjectIds(
  history: readonly SubjectsTaken[],
  curriculum: readonly CurriculumSubject[] = [],
): Set<string> {
  return new Set([
    ...history
      .filter(item => item.status === 'APPROVED' || item.status === 'EXEMPT')
      .map(item => normalizeSubjectId(item.id)),
    ...curriculum
      .filter(item => item.alreadyTaken)
      .map(item => normalizeSubjectId(item.id)),
  ]);
}

/** Positive completion evidence survives a missing or stale second source. */
export function reconcileCurriculumCompletion(
  curriculum: readonly CurriculumSubject[],
  history: readonly SubjectsTaken[],
): CurriculumSubject[] {
  const completed = completedSubjectIds(history, curriculum);
  return curriculum.map(item =>
    !item.alreadyTaken && completed.has(normalizeSubjectId(item.id))
      ? { ...item, alreadyTaken: true }
      : item,
  );
}
