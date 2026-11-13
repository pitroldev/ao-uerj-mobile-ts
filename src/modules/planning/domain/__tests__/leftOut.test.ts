import type {
  SubjectClassesSchedule,
  SubjectInfo,
} from '@root/modules/academics/domain/models';

import { leftOutReason } from '../leftOut';
import { lunchBreak } from '../lunch';
import type { GeneratedClassWithSubject, Schedule } from '../models';

const vacancies = { uerj: {}, freshman: {} };
const turma = (
  classNumber: number,
  schedule: SubjectClassesSchedule['schedule'],
): SubjectClassesSchedule => ({ classNumber, schedule, vacancies });
const subject = (
  id: string,
  classes: SubjectClassesSchedule[],
  extra: Partial<SubjectInfo> = {},
): SubjectInfo => ({ id, name: `Disciplina ${id}`, classes, ...extra });

/** Uma turma na grade gerada. */
const placed = (
  id: string,
  name: string,
  schedules: Schedule[],
  allow_conflict = false,
): GeneratedClassWithSubject => ({
  id: '1',
  name,
  type: 'REGULAR',
  teachers: [],
  vacancies_amount: 10,
  subject_id: id,
  schedules,
  subject: {
    id,
    name,
    type: 'MANDATORY',
    credits: 4,
    total_workload: 60,
    prerequisites: [],
    allow_conflict,
  },
});
const at = (week_day: number, start: number, end: number): Schedule => ({
  week_day,
  start_time_in_minutes: start,
  end_time_in_minutes: end,
});

/** Na grade: Cálculo na segunda M6–T1 e Física na terça N1–N2. */
const GRADE = [
  placed('IME01-1', 'Cálculo', [at(0, 690, 800)]),
  placed('IFC01-1', 'Física', [at(1, 1080, 1180)]),
];
const LUNCH = lunchBreak(50)!;
const NONE = new Set<string>();

it('blames the routine when no class fits it, and says which part of it', () => {
  const morning = turma(1, [{ Quarta: [['M1', 'M2']] }]);
  // sozinha, toma o T1: nunca sobram dois tempos seguidos para o almoço
  const overLunch = turma(2, [{ Sábado: [['T1']] }]);
  const busy = [at(2, 420, 520)];
  expect(
    leftOutReason({
      subject: subject('IME02-1', [morning]),
      grade: GRADE,
      busy,
      removed: NONE,
    }),
  ).toEqual({ kind: 'ROUTINE', by: 'BUSY', classes: 1 });
  expect(
    leftOutReason({
      subject: subject('IME02-1', [overLunch]),
      grade: GRADE,
      busy: [],
      lunch: lunchBreak(100),
      removed: NONE,
    }),
  ).toEqual({ kind: 'ROUTINE', by: 'LUNCH', classes: 1 });
  expect(
    leftOutReason({
      subject: subject('IME02-1', [morning, overLunch]),
      grade: GRADE,
      busy,
      lunch: lunchBreak(100),
      removed: NONE,
    }),
  ).toEqual({ kind: 'ROUTINE', by: 'BOTH', classes: 2 });
});

it('says the student took the classes out', () => {
  expect(
    leftOutReason({
      subject: subject('IME02-1', [turma(1, [{ Quarta: [['M1', 'M2']] }])]),
      grade: GRADE,
      busy: [],
      removed: new Set(['IME02-1#1']),
    }),
  ).toEqual({ kind: 'REMOVED' });
});

it('names the subjects it clashes with, from the class with fewer clashes', () => {
  expect(
    leftOutReason({
      subject: subject('IME02-1', [
        // bate com as duas
        turma(1, [{ Segunda: [['M6']] }, { Terça: [['N1']] }]),
        // bate só com Física
        turma(2, [{ Terça: [['N1', 'N2']] }]),
      ]),
      grade: GRADE,
      busy: [],
      removed: NONE,
    }),
  ).toEqual({ kind: 'CLASH', with: ['Física'] });
});

it('does not count a clash the portal allows', () => {
  const clashing = [turma(1, [{ Terça: [['N1', 'N2']] }])];
  expect(
    leftOutReason({
      subject: subject('IME02-1', clashing, { conflito: true }),
      grade: GRADE,
      busy: [],
      removed: NONE,
    }),
  ).toEqual({ kind: 'LIMIT' });
  expect(
    leftOutReason({
      subject: subject('IME02-1', clashing),
      grade: [GRADE[0], placed('IFC01-1', 'Física', [at(1, 1080, 1180)], true)],
      busy: [],
      removed: NONE,
    }),
  ).toEqual({ kind: 'LIMIT' });
});

it('blames the lunch when the class fits but takes the last free slot', () => {
  // segunda já tem M6–T1; o T2 dela fecharia a janela
  expect(
    leftOutReason({
      subject: subject('IME02-1', [turma(1, [{ Segunda: [['T2', 'T3']] }])]),
      grade: GRADE,
      busy: [],
      lunch: LUNCH,
      removed: NONE,
    }),
  ).toEqual({ kind: 'LUNCH' });
  // sem o almoço pedido, a mesma turma cabe: ficou de fora pelo limite
  expect(
    leftOutReason({
      subject: subject('IME02-1', [turma(1, [{ Segunda: [['T2', 'T3']] }])]),
      grade: GRADE,
      busy: [],
      removed: NONE,
    }),
  ).toEqual({ kind: 'LIMIT' });
});
