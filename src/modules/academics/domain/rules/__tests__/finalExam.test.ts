import {
  finalExamOutlook,
  isPassingGrade,
  neededFinalExam,
  projectCumulativeAverage,
  projectedFinal,
  type PeriodFinal,
} from '../finalExam';
import type { SubjectsTaken } from '../../models';

const course = (fields: Partial<SubjectsTaken> = {}): SubjectsTaken => ({
  id: 'IME01-12345',
  name: 'Álgebra',
  period: '2025.2',
  credits: 4,
  workload: 60,
  type: 'MANDATORY',
  frequency: 100,
  grade: 8,
  status: 'APPROVED',
  ...fields,
});

describe('final exam outlook (art. 95, credit system)', () => {
  it('asks for 10 minus the semester average on the final exam', () => {
    expect(finalExamOutlook({ p1: 5.5, p2: 6.1 })).toEqual({
      kind: 'final-exam',
      average: 5.8,
      needed: 4.2,
    });
    expect(finalExamOutlook({ p1: 4, p2: 4 })).toMatchObject({
      kind: 'final-exam',
      needed: 6,
    });
  });

  it('rounds the needed grade up, so it always reaches 5,0', () => {
    // média 5,85: 4,15 não basta com uma casa; 4,2 dá 5,025
    const outlook = finalExamOutlook({ p1: 5.5, p2: 6.2 });
    expect(outlook).toMatchObject({ kind: 'final-exam', needed: 4.2 });
    expect(isPassingGrade(projectedFinal(outlook, 4.2) as number)).toBe(true);
    expect(isPassingGrade(projectedFinal(outlook, 4.1) as number)).toBe(false);
    expect(neededFinalExam(6.95)).toBe(3.1);
  });

  it('exempts from 7,0 and denies the final exam below 4,0', () => {
    expect(finalExamOutlook({ p1: 7, p2: 7 })).toEqual({
      kind: 'exempt',
      average: 7,
    });
    expect(finalExamOutlook({ p1: 6.9, p2: 7 })).toMatchObject({
      kind: 'final-exam',
    });
    expect(finalExamOutlook({ p1: 3.2, p2: 4 })).toEqual({
      kind: 'no-final-exam',
      average: 3.6,
    });
    expect(finalExamOutlook({ p1: 4, p2: 3.9 })).toMatchObject({
      kind: 'no-final-exam',
    });
  });

  it('fails below 4,0 even when a final exam shows up graded (§ 7º)', () => {
    expect(finalExamOutlook({ p1: 3, p2: 4, pf: 7 })).toEqual({
      kind: 'no-final-exam',
      average: 3.5,
    });
  });

  it('does not average a final exam without both exams', () => {
    expect(finalExamOutlook({ p1: 7.5, p2: null, pf: 6 })).toEqual({
      kind: 'incomplete',
    });
    expect(finalExamOutlook({ pf: 5 })).toEqual({ kind: 'incomplete' });
    expect(projectedFinal({ kind: 'incomplete' })).toBeNull();
  });

  it('averages the final exam once it is graded, even for exempt students', () => {
    expect(finalExamOutlook({ p1: 5, p2: 5, pf: 6 })).toEqual({
      kind: 'final-exam-done',
      average: 5,
      exam: 6,
      final: 5.5,
    });
    expect(finalExamOutlook({ p1: 8, p2: 8, pf: 0 })).toMatchObject({
      kind: 'final-exam-done',
      final: 4,
    });
  });

  it('trusts the average published by the portal', () => {
    expect(finalExamOutlook({ p1: 5, p2: 5, pf: null, result: 6.25 })).toEqual({
      kind: 'published',
      final: 6.25,
    });
  });

  it('tells what the missing exam needs for exemption or for the final exam', () => {
    expect(finalExamOutlook({ p1: 7.5, p2: null })).toEqual({
      kind: 'second-pending',
      pending: 'p2',
      forExemption: 6.5,
      forFinalExam: 0.5,
    });
    // com 3,0 na P1, nem 10 na P2 dispensa: 5,0 garante o direito à PF
    expect(finalExamOutlook({ p1: null, p2: 3 })).toEqual({
      kind: 'second-pending',
      pending: 'p1',
      forExemption: null,
      forFinalExam: 5,
    });
    expect(finalExamOutlook({ p1: 9, p2: null })).toMatchObject({
      forExemption: 5,
      forFinalExam: 0,
    });
    // com 4,0 na P1, só 10 na P2 dispensa
    expect(finalExamOutlook({ p1: 4 })).toMatchObject({
      forExemption: 10,
      forFinalExam: 4,
    });
  });

  it('has nothing to say without grades', () => {
    expect(finalExamOutlook({})).toEqual({ kind: 'no-grades' });
    expect(finalExamOutlook({ p1: null, p2: Number.NaN })).toEqual({
      kind: 'no-grades',
    });
  });
});

describe('projected final grade', () => {
  it('uses the published, taken or simulated grade, or the semester average', () => {
    expect(projectedFinal({ kind: 'published', final: 6 })).toBe(6);
    expect(projectedFinal({ kind: 'exempt', average: 7.7 })).toBe(7.7);
    expect(projectedFinal({ kind: 'no-final-exam', average: 3.6 })).toBe(3.6);
    expect(
      projectedFinal({ kind: 'final-exam', average: 5.8, needed: 4.2 }, 6),
    ).toBeCloseTo(5.9);
    expect(
      projectedFinal({ kind: 'final-exam', average: 5.8, needed: 4.2 }),
    ).toBeNull();
    expect(projectedFinal({ kind: 'no-grades' })).toBeNull();
  });
});

/** Notas finais do período: [código, nota, simulada?]. */
const finalsOf = (...entries: [string, number, boolean?][]) =>
  new Map<string, PeriodFinal>(
    entries.map(([key, grade, simulated = false]) => [
      key,
      { grade, simulated },
    ]),
  );

describe('projected CR', () => {
  const history = [
    course({ grade: 8, credits: 4 }),
    course({ id: 'IME01-12346', grade: 6, credits: 4 }),
    course({
      id: 'IME02-00777',
      period: '2026.1',
      status: 'IN_PROGRESS',
      grade: null,
      credits: 6,
    }),
  ];
  const credits = new Map([
    ['777', 6],
    ['778', 4],
  ]);

  it('adds the period grades as new attempts, weighted by credits', () => {
    // 778 não está no histórico: os créditos vêm do currículo
    const result = projectCumulativeAverage(
      history,
      finalsOf(['777', 5, true], ['778', 9]),
      credits,
    );
    expect(result.current).toBe(7);
    // (8·4 + 6·4 + 5·6 + 9·4) / 18
    expect(result.projected).toBe(6.78);
    expect(result.counted).toEqual(['777', '778']);
    expect(result.missing).toEqual([]);
  });

  it('counts failures by grade and leaves out subjects without credits', () => {
    const result = projectCumulativeAverage(
      history,
      finalsOf(['777', 3, true], ['999', 10]),
      credits,
    );
    // (8·4 + 6·4 + 3·6) / 14
    expect(result.projected).toBe(5.29);
    expect(result.counted).toEqual(['777']);
    expect(result.missing).toEqual(['999']);
  });

  it('leaves zero-credit activities out of the CR without calling them missing', () => {
    const result = projectCumulativeAverage(
      history,
      finalsOf(['777', 5], ['780', 10]),
      new Map([...credits, ['780', 0]]),
    );
    // (8·4 + 6·4 + 5·6) / 14
    expect(result.projected).toBe(6.14);
    expect(result.counted).toEqual(['777']);
    expect(result.missing).toEqual([]);
  });

  it('keeps the CR without period grades', () => {
    expect(projectCumulativeAverage(history, new Map(), credits)).toEqual({
      current: 7,
      projected: 7,
      counted: [],
      missing: [],
    });
  });

  it('has no current CR before the first graded period', () => {
    expect(
      projectCumulativeAverage([], finalsOf(['777', 6.5]), credits),
    ).toEqual({ current: null, projected: 6.5, counted: ['777'], missing: [] });
    expect(projectCumulativeAverage([], new Map(), credits)).toMatchObject({
      current: null,
      projected: null,
    });
  });

  describe('once the period is closed in the history', () => {
    const closed = [
      course({ grade: 8, credits: 4 }),
      course({ id: 'IME01-12346', grade: 6, credits: 4 }),
      course({ id: 'IME02-00777', period: '2026.1', grade: 5, credits: 6 }),
      course({ id: 'IME02-00778', period: '2026.1', grade: 9, credits: 4 }),
    ];

    it('does not count the period twice when the portal names it', () => {
      const result = projectCumulativeAverage(
        closed,
        finalsOf(['777', 5], ['778', 9]),
        credits,
        '2026.1',
      );
      expect(result.current).toBe(6.78);
      expect(result.projected).toBe(6.78);
    });

    it('matches the last period with the same grades when the portal does not', () => {
      const result = projectCumulativeAverage(
        closed,
        finalsOf(['777', 5], ['778', 9]),
        credits,
      );
      expect(result.projected).toBe(result.current);
    });
  });

  it('keeps an earlier attempt of a subject taken again', () => {
    const retake = [
      course({ grade: 8, credits: 4 }),
      course({
        id: 'IME02-00777',
        period: '2025.2',
        grade: 3,
        credits: 6,
        status: 'FAILED_BY_GRADE',
      }),
    ];
    // a reprovação de 2025.2 continua no CR; a PF simulada entra como nova
    // tentativa, mesmo com a mesma nota
    const result = projectCumulativeAverage(
      retake,
      finalsOf(['777', 3, true]),
      credits,
    );
    // (8·4 + 3·6 + 3·6) / 16
    expect(result.projected).toBe(4.25);
    // com o período informado, a linha de 2025.2 não é a deste período:
    // (8·4 + 3·6 + 7·6) / 16
    expect(
      projectCumulativeAverage(retake, finalsOf(['777', 7]), credits, '2026.1')
        .projected,
    ).toBe(5.75);
  });
});
