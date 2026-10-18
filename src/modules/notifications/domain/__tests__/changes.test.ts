import type {
  ClassGrade,
  PartialRID,
} from '@root/modules/academics/domain/models';
import type { StudentDocument } from '@root/modules/documents/domain/models';
import {
  daysUntilValidity,
  documentNoticeKey,
  expiringDocuments,
  gradeChanges,
  knowGrades,
  knowRid,
  normalizeKnownReadings,
  ridChanges,
} from '../changes';

const grade = (
  id: string,
  grades: ClassGrade['grades'],
  overrides: Partial<ClassGrade> = {},
): ClassGrade => ({
  id,
  name: `Disciplina ${id}`,
  class: '1',
  grades,
  ...overrides,
});

describe('gradeChanges', () => {
  it('reports grades that appeared and grades that changed, per subject and class', () => {
    const previous = [
      grade('IME02-00001', { p1: 7.5, p2: null, pf: null, result: null }),
      grade('IME02-00002', { p1: 6, p2: 8, pf: null, result: 7 }),
    ];
    const current = [
      grade('IME02-00001', { p1: 7.5, p2: 9, pf: null, result: 8.3 }),
      grade('IME02-00002', { p1: 6.5, p2: 8, pf: null, result: 7 }),
    ];
    expect(gradeChanges(knowGrades({}, previous), current)).toEqual([
      {
        subjectId: 'IME02-00001',
        subjectName: 'Disciplina IME02-00001',
        classNumber: '1',
        grades: [
          { key: 'p2', value: 9, previous: null },
          { key: 'result', value: 8.3, previous: null },
        ],
      },
      {
        subjectId: 'IME02-00002',
        subjectName: 'Disciplina IME02-00002',
        classNumber: '1',
        grades: [{ key: 'p1', value: 6.5, previous: 6 }],
      },
    ]);
  });

  it('ignores unchanged and cleared grades', () => {
    const known = knowGrades({}, [grade('IME02-00001', { p1: 5, p2: 6 })]);
    expect(
      gradeChanges(known, [grade('IME02-00001', { p1: 5, p2: null })]),
    ).toEqual([]);
    expect(
      gradeChanges(known, [grade('IME02-00001', { p1: 5, p2: 6 })]),
    ).toEqual([]);
  });

  it('keeps a known grade through a blank reading', () => {
    const known = knowGrades({}, [grade('IME02-00001', { p1: 5, p2: 6 })]);
    // o portal devolveu a tabela em branco numa rodada, ou sem a disciplina
    const blank = knowGrades(
      knowGrades(known, [grade('IME02-00001', { p1: null, p2: null })]),
      [],
    );
    expect(blank).toEqual(known);
    expect(
      gradeChanges(blank, [grade('IME02-00001', { p1: 5, p2: 6 })]),
    ).toEqual([]);
    expect(
      gradeChanges(blank, [grade('IME02-00001', { p1: 5, p2: 7 })]),
    ).toEqual([
      expect.objectContaining({
        grades: [{ key: 'p2', value: 7, previous: 6 }],
      }),
    ]);
  });

  it('treats another class of the same subject as a different entry', () => {
    const previous = [grade('IME02-00001', { p1: 5 }, { class: '1' })];
    const current = [grade('IME02-00001', { p1: 5 }, { class: '2' })];
    expect(gradeChanges(knowGrades({}, previous), current)).toEqual([
      expect.objectContaining({
        classNumber: '2',
        grades: [{ key: 'p1', value: 5, previous: null }],
      }),
    ]);
  });
});

const rid = (overrides: Partial<PartialRID> = {}): PartialRID => ({
  id: 'IME02-00001',
  name: 'Cálculo II',
  classNumber: 3,
  available: 40,
  requested: 55,
  position: 12,
  status: 'Em análise',
  ...overrides,
});

describe('ridChanges', () => {
  it('reports a new position, a new status and a new subject', () => {
    const previous = [rid(), rid({ id: 'IME02-00002', position: 3 })];
    const current = [
      rid({ position: 5 }),
      rid({ id: 'IME02-00002', position: 3, status: 'Atendido' }),
      rid({ id: 'IME02-00003', position: 0, status: 'Choque de horário' }),
    ];
    expect(ridChanges(knowRid({}, previous), current)).toEqual([
      expect.objectContaining({
        subjectId: 'IME02-00001',
        previousPosition: 12,
        position: 5,
        statusChanged: false,
      }),
      expect.objectContaining({
        subjectId: 'IME02-00002',
        previousPosition: 3,
        position: 3,
        status: 'Atendido',
        statusChanged: true,
      }),
      expect.objectContaining({
        subjectId: 'IME02-00003',
        previousPosition: null,
        position: 0,
        classNumber: '3',
      }),
    ]);
  });

  it('ignores spacing and case in the status', () => {
    expect(
      ridChanges(knowRid({}, [rid({ status: 'Em  análise' })]), [
        rid({ status: 'em análise' }),
      ]),
    ).toEqual([]);
  });

  it('keeps the known requests through an empty reading', () => {
    const current = [rid(), rid({ id: 'IME02-00002', position: 3 })];
    const known = knowRid({}, current);
    // "Não há resultado provisório" numa rodada não apaga a referência
    const empty = knowRid(known, []);
    expect(empty).toEqual(known);
    expect(ridChanges(empty, current)).toEqual([]);
  });
});

describe('normalizeKnownReadings', () => {
  it('reads a saved reference defensively', () => {
    expect(normalizeKnownReadings(null)).toBeNull();
    expect(normalizeKnownReadings({ grades: {} })).toBeNull();
    expect(
      normalizeKnownReadings({
        period: '2026.2',
        grades: {
          'IME02-00001#1': { p1: 7, p2: 'oito', pf: null },
          'IME02-00002#1': { p1: null },
          'IME02-00003#1': 'x',
        },
        rid: {
          'IME02-00001#3': { position: 5, status: 'Em análise' },
          'IME02-00002#3': { position: '5', status: 'Em análise' },
        },
        enrollment: {
          'IME02-00001#3': { accepted: true, reason: '' },
          'IME02-00002#3': { accepted: 'sim', reason: '' },
        },
      }),
    ).toEqual({
      period: '2026.2',
      grades: { 'IME02-00001#1': { p1: 7 } },
      rid: { 'IME02-00001#3': { position: 5, status: 'Em análise' } },
      enrollment: { 'IME02-00001#3': { accepted: true, reason: '' } },
    });
  });
});

const NOON_OCT_17 = new Date(2026, 9, 17, 12, 0).getTime();

describe('daysUntilValidity', () => {
  it.each([
    ['17/10/2026', 0],
    ['18/10/2026', 1],
    ['20/10/2026', 3],
    ['16/10/2026', -1],
    ['01/01/2027', 76],
  ])('%s is %p days away', (validity, days) => {
    expect(daysUntilValidity(validity, NOON_OCT_17)).toBe(days);
  });

  it.each([null, '', '2026-10-20', '31/02/2026', '20/10/26'])(
    'has no answer for %p',
    validity => {
      expect(daysUntilValidity(validity, NOON_OCT_17)).toBeNull();
    },
  );
});

const studentDocument = (
  overrides: Partial<StudentDocument> = {},
): StudentDocument => ({
  id: '1:2:3',
  title: 'Declaração de Matrícula',
  validUntil: '20/10/2026',
  hasExistingDocument: true,
  canIssue: true,
  canDelete: true,
  revision: '3',
  ...overrides,
});

describe('expiringDocuments', () => {
  it('keeps issued documents that expire within the window', () => {
    const documents = [
      studentDocument(),
      studentDocument({ id: 'a', validUntil: '21/10/2026' }),
      studentDocument({ id: 'b', validUntil: '16/10/2026' }),
      studentDocument({ id: 'c', hasExistingDocument: false }),
      studentDocument({ id: 'd', validUntil: null }),
    ];
    expect(expiringDocuments(documents, NOON_OCT_17, 3)).toEqual([
      { document: documents[0], daysLeft: 3 },
    ]);
  });

  it('keys a notice by type, revision and validity', () => {
    expect(documentNoticeKey(studentDocument())).toBe('1:2:3|3|20/10/2026');
    expect(
      documentNoticeKey(
        studentDocument({ revision: '4', validUntil: '25/10/2026' }),
      ),
    ).toBe('1:2:3|4|25/10/2026');
  });
});
