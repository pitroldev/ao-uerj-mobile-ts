import type { CurriculumSubject, SubjectsTaken } from '../../models';
import {
  completedSubjectIds,
  reconcileCurriculumCompletion,
} from '../completion';

const curriculum: CurriculumSubject = {
  id: 'ABC01-00123',
  name: 'Disciplina',
  type: 'MANDATORY',
  credits: 4,
  workload: 60,
  minimum_credits: null,
  alreadyTaken: false,
};
const attempt = (
  status: SubjectsTaken['status'],
  id = curriculum.id,
): SubjectsTaken => ({
  id,
  name: curriculum.name,
  period: '2024.2',
  type: 'MANDATORY',
  credits: 4,
  workload: 60,
  frequency: null,
  grade: null,
  status,
});

it.each(['APPROVED', 'EXEMPT'] as const)(
  'recognizes %s from history despite a stale negative curriculum flag',
  status => {
    const result = reconcileCurriculumCompletion(
      [curriculum],
      [attempt(status, 'abc01-00123')],
    );
    expect(result[0].alreadyTaken).toBe(true);
    expect(curriculum.alreadyTaken).toBe(false);
    expect(completedSubjectIds([attempt(status, '123')])).toEqual(
      new Set(['123']),
    );
  },
);

it('preserves official completion without history and never infers equivalence from a name', () => {
  const official = { ...curriculum, alreadyTaken: true };
  expect(
    reconcileCurriculumCompletion([official], [attempt('FAILED_BY_GRADE')])[0],
  ).toBe(official);
  expect(
    reconcileCurriculumCompletion(
      [curriculum],
      [attempt('APPROVED', 'ABC01-00456')],
    )[0],
  ).toBe(curriculum);
  expect(completedSubjectIds([], [official])).toEqual(new Set(['123']));
});

it.each([
  'FAILED_BY_GRADE',
  'FAILED_BY_ATTENDANCE',
  'CANCELED',
  'IN_PROGRESS',
] as const)('does not count %s as a completed course', status => {
  expect(
    reconcileCurriculumCompletion([curriculum], [attempt(status)])[0],
  ).toBe(curriculum);
});
