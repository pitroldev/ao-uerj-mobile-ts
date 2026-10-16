import {
  academicWeekdayToPlanningDay,
  availableClasses,
  hasScheduleConflict,
  prerequisitesSatisfied,
  scheduleIntervals,
  subjectEligibility,
} from '../rules';
import { SubjectsTaken } from '@root/modules/academics/domain/models';
import { curriculum, details } from '../../application/testFixtures';

const completed = (
  id: string,
  status: SubjectsTaken['status'] = 'APPROVED',
): SubjectsTaken => ({
  id,
  name: 'Disciplina',
  period: '2024/1',
  credits: 4,
  workload: 60,
  type: 'MANDATORY',
  grade: status === 'EXEMPT' ? null : 8,
  frequency: null,
  status,
});
const prereq = (id: string) => ({ id, name: id });

it('keeps OR alternatives within rows and AND requirements across rows', () => {
  const groups = [
    [prereq('IME01-11111'), prereq('IME01-22222')],
    [prereq('IME01-33333')],
  ];
  expect(
    prerequisitesSatisfied(groups, [
      completed('IME01-22222'),
      completed('IME01-33333', 'EXEMPT'),
    ]),
  ).toBe(true);
  expect(prerequisitesSatisfied(groups, [completed('IME01-11111')])).toBe(
    false,
  );
  expect(
    prerequisitesSatisfied(groups, [
      completed('IME01-11111', 'FAILED_BY_GRADE'),
      completed('IME01-33333'),
    ]),
  ).toBe(false);
});

it('counts exempt credits without counting a repeated completed course twice', () => {
  const history = [
    completed('IME01-11111'),
    completed('IME01-11111'),
    completed('IME01-22222', 'EXEMPT'),
  ];
  expect(
    subjectEligibility({ ...curriculum, minimum_credits: 8 }, details, history)
      .eligible,
  ).toBe(true);
  expect(
    subjectEligibility({ ...curriculum, minimum_credits: 9 }, details, history)
      .eligible,
  ).toBe(false);
});

it('accepts an official completed prerequisite absent from history without inventing credits', () => {
  const required = { ...curriculum, id: 'IME01-11111', alreadyTaken: true };
  const target = { ...details, prerequisite: [[prereq(required.id)]] };
  expect(subjectEligibility(curriculum, target, [], [required]).eligible).toBe(
    true,
  );
  expect(
    subjectEligibility(
      { ...curriculum, minimum_credits: 1 },
      target,
      [],
      [required],
    ),
  ).toMatchObject({
    eligible: false,
    reason: 'Você não possui créditos suficientes.',
  });
  expect(
    prerequisitesSatisfied([[prereq('IME01-22222')]], [], [required]),
  ).toBe(false);
});

it('uses Monday=0 for both the busy-hours picker and class data', () => {
  const [interval] = scheduleIntervals([{ Segunda: [['M1', 'M2']] }]);
  const busy = { ...interval, week_day: academicWeekdayToPlanningDay(1) };
  expect(interval.week_day).toBe(0);
  expect(hasScheduleConflict([interval], [busy])).toBe(true);
  expect(availableClasses([details], [busy])).toEqual([]);
  expect(availableClasses([details], [{ ...busy, week_day: 1 }])).toHaveLength(
    1,
  );
});

it('treats touching boundaries as free and rejects unrecognized time slots', () => {
  expect(
    hasScheduleConflict(
      [{ week_day: 0, start_time_in_minutes: 100, end_time_in_minutes: 150 }],
      [{ week_day: 0, start_time_in_minutes: 150, end_time_in_minutes: 200 }],
    ),
  ).toBe(false);
  expect(() => scheduleIntervals([{ Segunda: [['X1' as 'M1']] }])).toThrow(
    'Horário de turma inválido.',
  );
});
