import type {
  ClassGrade,
  EnrollmentResultEntry,
} from '@root/modules/academics/domain/models';
import {
  enrollmentChanges,
  hasNewAcceptance,
  hasNewApproval,
  knowEnrollment,
  knowGrades,
} from '../changes';
import { EMPTY_CHECK_STATE, normalizeCheckState } from '../checkState';

const grade = (
  grades: ClassGrade['grades'],
  id = 'IME02-00001',
): ClassGrade => ({
  id,
  name: 'Cálculo II',
  class: '3',
  grades,
});

const entry = (
  overrides: Partial<EnrollmentResultEntry> = {},
): EnrollmentResultEntry => ({
  id: 'IME02-00001',
  name: 'Cálculo II',
  classNumber: '3',
  accepted: true,
  reason: '',
  ...overrides,
});

describe('hasNewApproval', () => {
  it('finds a subject the new grades approve', () => {
    const known = knowGrades({}, [
      grade({ p1: 7, p2: null, pf: null, result: null }),
    ]);
    // a P2 dispensa da PF
    expect(hasNewApproval(known, [grade({ p1: 7, p2: 8 })])).toBe(true);
    // a média final publicada
    expect(
      hasNewApproval(knowGrades({}, [grade({ p1: 5, p2: 6 })]), [
        grade({ p1: 5, p2: 6, pf: 6, result: 5.8 }),
      ]),
    ).toBe(true);
  });

  it('ignores an approval already known, a grade that does not approve and a failure', () => {
    const approved = knowGrades({}, [grade({ p1: 8, p2: 9 })]);
    expect(
      hasNewApproval(approved, [grade({ p1: 8, p2: 9, result: 8.5 })]),
    ).toBe(false);
    expect(
      hasNewApproval(knowGrades({}, [grade({ p1: 5 })]), [
        grade({ p1: 5, p2: 6 }),
      ]),
    ).toBe(false);
    expect(
      hasNewApproval(knowGrades({}, [grade({ p1: 5, p2: 5 })]), [
        grade({ p1: 5, p2: 5, pf: 3, result: 4 }),
      ]),
    ).toBe(false);
  });
});

describe('hasNewAcceptance', () => {
  it('finds a seat that was not accepted before, or a new subject accepted', () => {
    const before = [entry({ accepted: false, reason: 'Sem vaga' })];
    expect(
      hasNewAcceptance(
        enrollmentChanges(knowEnrollment({}, before), [
          entry({ accepted: true }),
        ]),
      ),
    ).toBe(true);
    expect(
      hasNewAcceptance(
        enrollmentChanges(knowEnrollment({}, []), [
          entry({ id: 'IME02-00009' }),
        ]),
      ),
    ).toBe(true);
  });

  it('ignores a refusal and a new reason on a seat already accepted', () => {
    expect(
      hasNewAcceptance(
        enrollmentChanges(knowEnrollment({}, []), [
          entry({ accepted: false, reason: 'Sem vaga' }),
        ]),
      ),
    ).toBe(false);
    expect(
      hasNewAcceptance(
        enrollmentChanges(knowEnrollment({}, [entry()]), [
          entry({ reason: 'Remanejado' }),
        ]),
      ),
    ).toBe(false);
  });
});

it('keeps the time of the last good news in the check state', () => {
  expect(EMPTY_CHECK_STATE.goodNewsAt).toBeNull();
  expect(
    normalizeCheckState({ goodNewsAt: 1_700_000_000_000 }).goodNewsAt,
  ).toBe(1_700_000_000_000);
  expect(normalizeCheckState({ goodNewsAt: 'ontem' }).goodNewsAt).toBeNull();
});
