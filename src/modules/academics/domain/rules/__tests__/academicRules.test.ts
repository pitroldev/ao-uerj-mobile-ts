import {
  calculateCumulativeAverage,
  calculateCraProgression,
  calculateAcademicProgress,
  defaultElectiveCredits,
  getPeriodList,
  normalizeElectiveCredits,
  sortAcademicPeriods,
} from '../progress';
import { nextWeekdayIndex, schedulesConflict } from '../schedule';
import { SubjectsTaken, CurriculumSubject } from '../../models';

const course = (fields: Partial<SubjectsTaken> = {}): SubjectsTaken => ({
  id: 'IME01-12345',
  name: 'Álgebra',
  period: '2024/1',
  credits: 4,
  workload: 60,
  type: 'MANDATORY',
  frequency: 100,
  grade: 8,
  status: 'APPROVED',
  ...fields,
});
const curriculumCourse = (
  fields: Partial<CurriculumSubject> = {},
): CurriculumSubject => ({
  id: 'IME01-12345',
  name: 'Álgebra',
  type: 'MANDATORY',
  credits: 4,
  workload: 60,
  minimum_credits: null,
  ...fields,
});

describe('approximate CR policy', () => {
  it('weights all graded attempts, including failure followed by a successful repeat', () => {
    expect(
      calculateCumulativeAverage([
        course({ grade: 2, status: 'FAILED_BY_GRADE' }),
        course({ grade: 8, period: '2024/2' }),
        course({ id: 'IME01-12346', grade: 10, credits: 2 }),
      ]),
    ).toBe(6);
  });
  it('handles absent grades, exemption, zero and invalid credits without NaN', () => {
    const ignored = [
      course({ grade: null }),
      course({ status: 'IN_PROGRESS', grade: 8 }),
      course({ status: 'EXEMPT', grade: null }),
      course({ credits: 0 }),
      course({ grade: NaN }),
      course({ credits: Infinity }),
    ];
    expect(calculateCumulativeAverage(ignored)).toBe(0);
    expect(calculateCumulativeAverage([...ignored, course({ grade: 0 })])).toBe(
      0,
    );
    expect(calculateCumulativeAverage([...ignored, course({ grade: 7 })])).toBe(
      7,
    );
  });
  it('keeps complete periods so different years do not collide', () => {
    const history = [
      course({ period: '2023/1', grade: 4 }),
      course({ period: '2024/1', grade: 8 }),
    ];
    expect(calculateCraProgression(history)).toEqual({
      currentCRA: 6,
      pointsOverTime: [
        { label: '2023/1', cra: 4 },
        { label: '2024/1', cra: 6 },
      ],
    });
    expect(getPeriodList(history)).toEqual([
      { label: '2024/1 - CR Atual: 6', value: '2024/1' },
      { label: '2023/1 - CR: 4', value: '2023/1' },
    ]);
  });
  it('sorts periods without mutating input and preserves exemptions as a separate option', () => {
    const periods = ['2025/2', '2024/2', 'Isentas', '2025/1'];
    expect(sortAcademicPeriods(periods)).toEqual([
      'Isentas',
      '2024/2',
      '2025/1',
      '2025/2',
    ]);
    expect(periods[0]).toBe('2025/2');
    expect(
      getPeriodList([
        course({ period: 'Isentas', status: 'EXEMPT', grade: null }),
      ]),
    ).toEqual([{ label: 'Isentas', value: 'Isentas' }]);
  });
});

describe('curriculum progress', () => {
  it('counts repeated approval only once, counts exemptions, excludes failures and cancellations', () => {
    const history = [
      course(),
      course({ period: '2024/2' }),
      course({ id: 'IME01-10000', status: 'EXEMPT', grade: null }),
      course({ id: 'IME01-20000', status: 'FAILED_BY_ATTENDANCE' }),
      course({ id: 'IME01-30000', status: 'CANCELED' }),
    ];
    const progress = calculateAcademicProgress(
      history,
      [curriculumCourse(), curriculumCourse({ id: 'IME01-10000' })],
      defaultElectiveCredits,
    );
    expect(progress.approvedCount).toBe(2);
    expect(progress.byType.completedCredits.MANDATORY).toBe(8);
    expect(progress.byType.requiredCredits.MANDATORY).toBe(8);
    expect(progress.byType.percent.MANDATORY).toBe(100);
  });
  it('uses configured required credits for electives, not the size of the catalog', () => {
    const progress = calculateAcademicProgress(
      [course({ type: 'UNIVERSAL' })],
      [
        curriculumCourse({ type: 'UNIVERSAL' }),
        curriculumCourse({ id: 'IME01-12346', type: 'UNIVERSAL' }),
      ],
      { ...defaultElectiveCredits, UNIVERSAL: 6 },
    );
    expect(progress.byType.percent.UNIVERSAL).toBe(67);
    expect(progress.byType.requiredCredits.RESTRICTED).toBeNull();
    expect(progress.byType.percent.RESTRICTED).toBe(0);
  });
  it('caps completed progress and normalizes corrupted or negative preferences', () => {
    expect(
      normalizeElectiveCredits({
        RESTRICTED: -2,
        DEFINED: NaN,
        UNIVERSAL: 6.8,
      }),
    ).toEqual({ RESTRICTED: 0, DEFINED: 0, UNIVERSAL: 6 });
    expect(
      calculateAcademicProgress([course({ type: 'UNIVERSAL' })], [], {
        ...defaultElectiveCredits,
        UNIVERSAL: 2,
      }).byType.percent.UNIVERSAL,
    ).toBe(100);
  });
});

describe('weekly schedule', () => {
  it('handles an empty schedule and Sunday wrap-around without dereferencing an absent day', () => {
    expect(nextWeekdayIndex([], 0)).toBe(0);
    expect(nextWeekdayIndex([1, 3, 5], 0)).toBe(0);
    expect(nextWeekdayIndex([1, 3, 5], 6)).toBe(0);
    expect(nextWeekdayIndex([1, 3, 5], 3)).toBe(1);
    expect(nextWeekdayIndex([1, 3, 5], 4)).toBe(2);
  });
  it('treats adjacent classes as compatible and overlapping classes on the same day as conflicts', () => {
    const first = {
      dayNumber: 1,
      start_time_in_minutes: 480,
      end_time_in_minutes: 530,
    };
    expect(
      schedulesConflict(first, {
        ...first,
        start_time_in_minutes: 530,
        end_time_in_minutes: 580,
      }),
    ).toBe(false);
    expect(
      schedulesConflict(first, { ...first, start_time_in_minutes: 520 }),
    ).toBe(true);
    expect(schedulesConflict(first, { ...first, dayNumber: 2 })).toBe(false);
  });
});
