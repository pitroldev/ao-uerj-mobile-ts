import { CurriculumSubject, SubjectsTaken } from '../models';
import { completedSubjectIds } from './completion';
import { normalizeSubjectId } from './subjectId';

const subjectTypes = [
  'MANDATORY',
  'RESTRICTED',
  'DEFINED',
  'UNIVERSAL',
] as const;
export type SubjectType = (typeof subjectTypes)[number];
export type ElectiveType = Exclude<SubjectType, 'MANDATORY'>;
export type ElectiveCreditsConfig = Record<ElectiveType, number>;
export const defaultElectiveCredits: ElectiveCreditsConfig = {
  RESTRICTED: 0,
  DEFINED: 0,
  UNIVERSAL: 0,
};

export function normalizeElectiveCredits(
  value: Partial<ElectiveCreditsConfig> | null,
): ElectiveCreditsConfig {
  const amount = (type: ElectiveType) => {
    const credits = value?.[type];
    return typeof credits === 'number' && Number.isFinite(credits)
      ? Math.max(0, Math.floor(credits))
      : 0;
  };
  return {
    RESTRICTED: amount('RESTRICTED'),
    DEFINED: amount('DEFINED'),
    UNIVERSAL: amount('UNIVERSAL'),
  };
}

function isExemptionPeriod(period: string): boolean {
  return /isent|isenç|isenc/i.test(period);
}

export function sortAcademicPeriods(periods: readonly string[]): string[] {
  return [...new Set(periods)].sort((left, right) => {
    if (isExemptionPeriod(left) !== isExemptionPeriod(right))
      return isExemptionPeriod(left) ? -1 : 1;
    return left.localeCompare(right, 'pt-BR', { numeric: true });
  });
}

/** Preserves the existing approximate CR policy: every finite graded attempt is weighted. */
export function calculateCumulativeAverage(
  subjects: readonly SubjectsTaken[],
): number {
  let weightedGrades = 0;
  let credits = 0;
  for (const subject of subjects) {
    if (
      subject.status === 'IN_PROGRESS' ||
      subject.grade === null ||
      !Number.isFinite(subject.grade) ||
      subject.credits === null ||
      !Number.isFinite(subject.credits) ||
      subject.credits <= 0
    )
      continue;
    weightedGrades += subject.grade * subject.credits;
    credits += subject.credits;
  }
  return credits > 0 ? Number((weightedGrades / credits).toFixed(2)) : 0;
}

export function calculateCraProgression(subjects: readonly SubjectsTaken[]) {
  const periods = sortAcademicPeriods(subjects.map(subject => subject.period));
  const pointsOverTime = periods
    .filter(period => !isExemptionPeriod(period))
    .map(period => {
      const previousPeriods = new Set(
        periods.slice(0, periods.indexOf(period) + 1),
      );
      return {
        label: period,
        cra: calculateCumulativeAverage(
          subjects.filter(subject => previousPeriods.has(subject.period)),
        ),
      };
    });
  return { pointsOverTime, currentCRA: calculateCumulativeAverage(subjects) };
}

export function getPeriodList(subjects: readonly SubjectsTaken[]) {
  const periods = sortAcademicPeriods(subjects.map(subject => subject.period));
  const currentPeriod = [...periods]
    .reverse()
    .find(period => !isExemptionPeriod(period));
  return periods
    .map((period, index) => {
      if (isExemptionPeriod(period)) return { label: period, value: period };
      const previousPeriods = new Set(periods.slice(0, index + 1));
      const average = calculateCumulativeAverage(
        subjects.filter(subject => previousPeriods.has(subject.period)),
      );
      return {
        label: `${period} - CR${
          period === currentPeriod ? ' Atual' : ''
        }: ${average}`,
        value: period,
      };
    })
    .reverse();
}

export function calculateAcademicProgress(
  taken: readonly SubjectsTaken[],
  curriculum: readonly CurriculumSubject[],
  config: ElectiveCreditsConfig,
) {
  const emptyTotals = (): Record<SubjectType, number> => ({
    MANDATORY: 0,
    RESTRICTED: 0,
    DEFINED: 0,
    UNIVERSAL: 0,
  });
  const totals = emptyTotals();
  const completed = emptyTotals();
  const totalCredits = emptyTotals();
  const completedCredits = emptyTotals();
  const validCredits = (credits: number | null) =>
    credits !== null && Number.isFinite(credits) ? Math.max(0, credits) : 0;
  for (const subject of new Map(
    curriculum.map(item => [normalizeSubjectId(item.id), item]),
  ).values()) {
    if (!subjectTypes.includes(subject.type)) continue;
    totals[subject.type] += 1;
    totalCredits[subject.type] += validCredits(subject.credits);
  }
  // Repeating an approved course does not earn the same curriculum credits twice.
  const approved = new Map<string, Pick<SubjectsTaken, 'type' | 'credits'>>(
    taken
      .filter(
        subject => subject.status === 'APPROVED' || subject.status === 'EXEMPT',
      )
      .map(subject => [normalizeSubjectId(subject.id), subject]),
  );
  // A completed curriculum entry may have no attempt in this history (e.g.
  // transferred credits). Count the confirmed completion without inventing a
  // grade or completed credit amount absent from the historical record.
  const completedIds = completedSubjectIds(taken, curriculum);
  for (const subject of curriculum) {
    const id = normalizeSubjectId(subject.id);
    if (completedIds.has(id) && !approved.has(id)) {
      approved.set(id, {
        type: subject.type,
        credits: null,
      });
    }
  }
  for (const subject of approved.values()) {
    const type = subject.type as SubjectType;
    if (!subjectTypes.includes(type)) continue;
    completed[type] += 1;
    completedCredits[type] += validCredits(subject.credits);
  }
  const required = normalizeElectiveCredits(config);
  const requiredCredits: Record<SubjectType, number | null> = {
    MANDATORY: totalCredits.MANDATORY,
    RESTRICTED: required.RESTRICTED || null,
    DEFINED: required.DEFINED || null,
    UNIVERSAL: required.UNIVERSAL || null,
  };
  const remaining = emptyTotals();
  const percent = emptyTotals();
  for (const type of subjectTypes) {
    remaining[type] = Math.max(0, totals[type] - completed[type]);
    const denominator =
      type === 'MANDATORY' ? totals[type] : requiredCredits[type];
    const numerator =
      type === 'MANDATORY' ? completed[type] : completedCredits[type];
    percent[type] = denominator
      ? Math.min(100, Math.round((numerator / denominator) * 100))
      : 0;
  }
  return {
    approvedCount: approved.size,
    byType: {
      order: [...subjectTypes],
      totals,
      completed,
      remaining,
      totalCredits,
      completedCredits,
      requiredCredits,
      percent,
    },
  };
}
