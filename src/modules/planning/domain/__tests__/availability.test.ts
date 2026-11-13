import type {
  CurriculumSubject,
  SubjectClassesSchedule,
  SubjectInfo,
} from '@root/modules/academics/domain/models';

import {
  assembleGeneration,
  readySubjects,
  type SubjectAvailability,
} from '../availability';
import { GOALS, createGeneratorDraft, goalOf } from '../models';

const vacancies = { uerj: {}, freshman: {} };
const turma = (
  classNumber: number,
  schedule: SubjectClassesSchedule['schedule'],
): SubjectClassesSchedule => ({ classNumber, schedule, vacancies });

const curriculum = (id: string): CurriculumSubject => ({
  id,
  name: `Disciplina ${id}`,
  type: 'MANDATORY',
  credits: 4,
  workload: 60,
  minimum_credits: null,
});
const details = (
  id: string,
  classes: SubjectClassesSchedule[],
): SubjectInfo => ({ id, name: `Disciplina ${id}`, classes });

const A = curriculum('IME01-1');
const B = curriculum('IME01-2');
const C = curriculum('IME01-3');
const D = curriculum('IME01-4');

const AVAILABILITY = new Map<string, SubjectAvailability>([
  [
    A.id,
    {
      status: 'ready',
      details: details(A.id, [
        turma(1, [{ Segunda: [['M1', 'M2']] }]),
        turma(2, [{ Terça: [['M6', 'T1', 'T2', 'T3']] }]),
      ]),
    },
  ],
  [
    B.id,
    {
      status: 'ready',
      details: details(B.id, [turma(1, [{ Quarta: [['N1', 'N2']] }])]),
    },
  ],
  // sem turmas, recusada e ainda lendo: nenhuma entra no pedido
  [C.id, { status: 'ready', details: details(C.id, []) }],
  [
    D.id,
    {
      status: 'refused',
      reason: 'Falta cursar antes: Cálculo I',
      details: details(D.id, [turma(1, [{ Sexta: [['M1']] }])]),
    },
  ],
]);

const draft = {
  ...createGeneratorDraft(),
  selectedSubjects: [A, B, C, D],
};

it('starts with the compact goal and recognizes each goal', () => {
  expect(goalOf(createGeneratorDraft().priority)).toBe('COMPACT');
  expect(goalOf([...GOALS.ADVANCE])).toBe('ADVANCE');
  expect(goalOf(['MAX_WORKLOAD'])).toBeNull();
});

it('keeps only the subjects that can enter, in the order chosen', () => {
  expect(readySubjects(draft, AVAILABILITY).map(item => item.id)).toEqual([
    A.id,
    B.id,
  ]);
});

it('asks for every subject that can enter, with the classes that fit', () => {
  const params = assembleGeneration({
    draft,
    availability: AVAILABILITY,
    history: [],
  });
  expect(params).toMatchObject({
    min_subject_amount: 1,
    max_subject_amount: 2,
    lunch: null,
    priority: [...GOALS.COMPACT],
    selectedSubjects: [A, B, C, D],
  });
  expect(params.subjects.map(item => item.id)).toEqual([A.id, B.id]);
  expect(
    params.selectedClasses.map(
      group => `${group.subject_id}#${group.classNumber}`,
    ),
  ).toEqual(['IME01-1#1', 'IME01-1#2', 'IME01-2#1']);
});

it('applies the limit, the lunch, the busy hours and the classes taken out', () => {
  const params = assembleGeneration({
    draft: {
      ...draft,
      maxSubjects: 1,
      lunchMinutes: 50,
      busy_schedules: [
        { week_day: 2, start_time_in_minutes: 1080, end_time_in_minutes: 1130 },
      ],
      removedClasses: ['IME01-1#1'],
    },
    availability: AVAILABILITY,
    history: [],
  });
  expect(params.max_subject_amount).toBe(1);
  expect(params.lunch).toEqual({ start: 690, end: 850, minutes: 50 });
  // A: a turma 1 foi tirada e a 2 não deixa o almoço; B bate com o ocupado
  expect(params.selectedClasses).toEqual([]);
});

it('never asks for more subjects than can enter or than the generator takes', () => {
  expect(
    assembleGeneration({
      draft: { ...draft, maxSubjects: 9 },
      availability: AVAILABILITY,
      history: [],
    }).max_subject_amount,
  ).toBe(2);
  const many = Array.from({ length: 14 }, (_, index) =>
    curriculum(`IME09-${index}`),
  );
  expect(
    assembleGeneration({
      draft: { ...draft, selectedSubjects: many },
      availability: new Map(
        many.map(item => [
          item.id,
          {
            status: 'ready',
            details: details(item.id, [turma(1, [{ Segunda: [['M1']] }])]),
          },
        ]),
      ),
      history: [],
    }).max_subject_amount,
  ).toBe(12);
  // sem nenhuma disciplina pronta, o pedido segue válido (e o gerador explica)
  expect(
    assembleGeneration({ draft, availability: new Map(), history: [] })
      .max_subject_amount,
  ).toBe(1);
});
