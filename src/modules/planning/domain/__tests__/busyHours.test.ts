import {
  availableClasses,
  busyClashes,
  classBlock,
  missingPrerequisites,
  refusalText,
  routineFit,
  subjectShortfall,
  SubjectShortfall,
  TooManyClasses,
} from '../rules';
import { lunchBreak } from '../lunch';
import type {
  CurriculumSubject,
  SubjectClassesSchedule,
  SubjectInfo,
  SubjectsTaken,
} from '@root/modules/academics/domain/models';
import type { Schedule } from '../models';

/*
 * Turmas como as de Pedagogia da FFP (12/11/2026): a da noite tem um tempo no
 * sábado, e é o sábado ocupado que a tira da grade.
 */
const turma = (classNumber: number, groups: SubjectClassesSchedule[]) =>
  groups.map(group => ({ ...group, classNumber }));
const subject = (
  id: string,
  classes: SubjectClassesSchedule[],
): SubjectInfo => ({ id, name: `Disciplina ${id}`, classes });
const vacancies = { uerj: {}, freshman: {} };

const NIGHT_AND_SATURDAY: SubjectClassesSchedule = {
  schedule: [{ Segunda: [['N1', 'N2']] }, { Sábado: [['T1']] }],
  vacancies,
};
const MORNING: SubjectClassesSchedule = {
  schedule: [{ Terça: [['M1', 'M2']] }],
  vacancies,
};
const NIGHT: SubjectClassesSchedule = {
  schedule: [{ Quarta: [['N1', 'N2']] }],
  vacancies,
};
/** Do M6 ao T3 (11:30 às 15:10): sozinha, cobre a janela do almoço. */
const OVER_LUNCH: SubjectClassesSchedule = {
  schedule: [{ Terça: [['M6', 'T1', 'T2', 'T3']] }],
  vacancies,
};

/** O sábado à tarde inteiro ocupado (12:20 às 17:50). */
const SATURDAY_AFTERNOON: Schedule[] = [
  { week_day: 5, start_time_in_minutes: 740, end_time_in_minutes: 1070 },
];
const LUNCH = lunchBreak(50)!;

const SUBJECTS = [
  subject('FFP04-1', turma(1, [NIGHT_AND_SATURDAY])),
  subject('FFP04-2', [
    ...turma(1, [NIGHT_AND_SATURDAY]),
    ...turma(2, [MORNING]),
  ]),
  subject('FFP04-3', turma(1, [NIGHT])),
];

const classesOf = (subjects: SubjectInfo[]) =>
  subjects.flatMap(s =>
    (s.classes ?? []).map(c => ({ ...c, subject_id: s.id! })),
  );

describe('busyClashes and classBlock', () => {
  it('returns the busy slots a class meets in, and nothing for a free class', () => {
    expect(busyClashes(NIGHT_AND_SATURDAY, SATURDAY_AFTERNOON)).toEqual(
      SATURDAY_AFTERNOON,
    );
    expect(busyClashes(NIGHT, SATURDAY_AFTERNOON)).toEqual([]);
    expect(busyClashes(NIGHT_AND_SATURDAY, [])).toEqual([]);
  });

  it('blocks a class for a busy hour or, alone, for leaving no lunch', () => {
    expect(classBlock(NIGHT_AND_SATURDAY, SATURDAY_AFTERNOON, LUNCH)).toEqual({
      kind: 'BUSY',
      clashes: SATURDAY_AFTERNOON,
    });
    expect(classBlock(OVER_LUNCH, [], LUNCH)).toEqual({
      kind: 'LUNCH',
      days: [1],
    });
    // sem o almoço pedido, a mesma turma cabe
    expect(classBlock(OVER_LUNCH, [])).toBeNull();
    expect(classBlock(MORNING, SATURDAY_AFTERNOON, LUNCH)).toBeNull();
  });

  it('keeps only the classes that fit the routine', () => {
    const lunchOnly = subject('IME01-1', [
      ...turma(1, [OVER_LUNCH]),
      ...turma(2, [NIGHT]),
    ]);
    expect(
      availableClasses([lunchOnly], [], LUNCH).map(group => group.classNumber),
    ).toEqual([2]);
    expect(availableClasses([lunchOnly], [])).toHaveLength(2);
  });
});

describe('routineFit', () => {
  it('counts each subject classes and how many fit the routine', () => {
    expect(routineFit(SUBJECTS, SATURDAY_AFTERNOON)).toEqual([
      { id: 'FFP04-1', name: 'Disciplina FFP04-1', classes: 1, free: 0 },
      { id: 'FFP04-2', name: 'Disciplina FFP04-2', classes: 2, free: 1 },
      { id: 'FFP04-3', name: 'Disciplina FFP04-3', classes: 1, free: 1 },
    ]);
  });
});

describe('subjectShortfall', () => {
  it('is null when the selected free classes reach the minimum', () => {
    expect(
      subjectShortfall({
        minimum: 3,
        subjects: SUBJECTS,
        selectedClasses: classesOf(SUBJECTS),
        busy: [],
      }),
    ).toBeNull();
  });

  it('blames the routine when it leaves too few subjects with a free class', () => {
    const shortfall = subjectShortfall({
      minimum: 3,
      subjects: SUBJECTS,
      selectedClasses: classesOf(SUBJECTS),
      busy: SATURDAY_AFTERNOON,
    });
    expect(shortfall).toBeInstanceOf(SubjectShortfall);
    expect(shortfall).toMatchObject({
      code: 'INVALID_INPUT',
      reason: 'ROUTINE',
      available: 2,
      total: 3,
      minimum: 3,
      message:
        'Só 2 de 3 disciplinas têm turma fora dos horários que você marcou como ocupados, e você pediu no mínimo 3. Libere algum horário.',
    });
    // com o mínimo de uma (o fluxo de hoje), a frase não fala em mínimo
    expect(
      subjectShortfall({
        minimum: 1,
        subjects: [SUBJECTS[0], SUBJECTS[1]],
        selectedClasses: classesOf([SUBJECTS[0], SUBJECTS[1]]),
        busy: [
          ...SATURDAY_AFTERNOON,
          { week_day: 1, start_time_in_minutes: 420, end_time_in_minutes: 520 },
        ],
        lunch: LUNCH,
      })?.message,
    ).toBe(
      'Nenhuma das 2 disciplinas tem turma fora dos horários que você marcou como ocupados e do almoço. Libere algum horário.',
    );
  });

  it('blames the choices when no subject has classes at all', () => {
    expect(
      subjectShortfall({
        minimum: 1,
        subjects: [subject('FFP04-4', [])],
        selectedClasses: [],
        busy: [],
      }),
    ).toMatchObject({
      reason: 'SUBJECTS',
      message:
        'Nenhuma das disciplinas escolhidas pode entrar na grade. Escolha outras disciplinas.',
    });
  });

  it('blames the selection when the student took the classes out', () => {
    expect(
      subjectShortfall({
        minimum: 1,
        subjects: SUBJECTS,
        selectedClasses: [],
        busy: [],
      }),
    ).toMatchObject({
      reason: 'SELECTION',
      available: 0,
      message: 'Você tirou todas as turmas. Marque alguma para gerar a grade.',
    });
  });

  it('says how many classes are over the limit', () => {
    expect(new TooManyClasses(34)).toMatchObject({
      code: 'INVALID_INPUT',
      selected: 34,
      limit: 30,
      message:
        'São 34 turmas, e o gerador combina até 30 de cada vez. Tire 4 turmas ou alguma disciplina.',
    });
  });
});

describe('refusalText', () => {
  const curriculum: CurriculumSubject = {
    id: 'IME02-2',
    name: 'Cálculo II',
    type: 'MANDATORY',
    credits: 4,
    workload: 60,
    minimum_credits: null,
  };
  const taken = (id: string): SubjectsTaken => ({
    id,
    name: id,
    period: '2025.2',
    credits: 4,
    workload: 60,
    type: 'MANDATORY',
    frequency: null,
    grade: 8,
    status: 'APPROVED',
  });
  const prerequisite = [
    [{ id: 'IME01-1', name: 'Cálculo I' }],
    [
      { id: 'IME01-2', name: 'Álgebra Linear' },
      { id: 'IME01-3', name: 'Geometria Analítica' },
    ],
  ];

  it('names the prerequisites still missing, with the alternatives', () => {
    expect(missingPrerequisites(prerequisite, [])).toEqual([
      'Cálculo I',
      'Álgebra Linear ou Geometria Analítica',
    ]);
    expect(missingPrerequisites(prerequisite, [taken('IME01-3')])).toEqual([
      'Cálculo I',
    ]);
    expect(refusalText(curriculum, { prerequisite }, [taken('IME01-3')])).toBe(
      'Falta cursar antes: Cálculo I',
    );
  });

  it('falls back to the credit lock', () => {
    expect(refusalText({ ...curriculum, minimum_credits: 140 }, {}, [])).toBe(
      'Exige 140 créditos cursados',
    );
  });
});
