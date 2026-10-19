import {
  blocksOf,
  buildGraduationPlan,
  deadlineSlack,
  electiveSlots,
  isBottleneck,
  PACE_CREDITS,
  prerequisiteGraph,
  type PlanSubject,
} from '../plan';
import { periodAfter, planIndexOf } from '../periods';

const subject = (
  key: string,
  credits: number,
  prerequisites: string[][] = [],
  fields: Partial<PlanSubject> = {},
): PlanSubject => ({
  key,
  id: `FEN04-${key.padStart(5, '0')}`,
  name: `Disciplina ${key}`,
  credits,
  workload: credits * 15,
  kind: 'MANDATORY',
  recommendedPeriod: 6,
  minimumCredits: 0,
  prerequisites,
  placeholder: false,
  ...fields,
});

// 1 → 2 → 3 → 4 é a cadeia mais longa; 1 também libera 5 e 6.
// 10 e 11 vêm do período em curso (contam como aprovadas).
const SUBJECTS = [
  subject('1', 4, [['10']]),
  subject('2', 4, [['1']], { recommendedPeriod: 7 }),
  subject('3', 4, [['2']], { recommendedPeriod: 8 }),
  subject('4', 4, [['3']], { recommendedPeriod: 9 }),
  subject('5', 4, [['1']], { recommendedPeriod: 7 }),
  subject('6', 4, [['1', '99']], { recommendedPeriod: 7 }),
  subject('7', 4, [['11']]),
  subject('8', 3, []),
  subject('9', 3, [], { recommendedPeriod: 9, minimumCredits: 120 }),
];
const COMPLETED = new Set(['10', '11']);

describe('prerequisite graph', () => {
  it('counts what each subject locks and finds the longest chain', () => {
    const graph = prerequisiteGraph(SUBJECTS, COMPLETED);
    // 6 tem a alternativa 99 (fora do plano e não cursada): só 1 serve
    expect(blocksOf(graph, '1')).toBe(5);
    expect(isBottleneck(graph, '1')).toBe(true);
    expect(isBottleneck(graph, '2')).toBe(false);
    expect(graph.chain).toEqual(['1', '2', '3', '4']);
  });

  it('does not lock a subject that has another way in', () => {
    const graph = prerequisiteGraph(
      [subject('1', 4), subject('2', 4), subject('3', 4, [['1', '2']])],
      new Set(),
    );
    expect(blocksOf(graph, '1')).toBe(0);
    expect(graph.requires.get('3')).toEqual([]);
  });

  it('leaves out what can never be reached, also through another subject', () => {
    const graph = prerequisiteGraph(
      [subject('1', 4, [['500']]), subject('2', 4, [['1']]), subject('3', 4)],
      new Set(),
    );
    expect([...graph.unreachable].sort()).toEqual(['1', '2']);
  });
});

describe('graduation plan', () => {
  it('fills each period up to the pace, bottlenecks first', () => {
    const plan = buildGraduationPlan(SUBJECTS, {
      completed: COMPLETED,
      credits: 110,
      cap: 12,
    });
    expect(plan.periods.map(p => p.subjects.map(s => s.key))).toEqual([
      ['1', '7', '8'],
      ['2', '5', '6'],
      ['3', '9'],
      ['4'],
    ]);
    expect(plan.periods.map(p => p.credits)).toEqual([11, 12, 7, 4]);
    // 9 pede 120 créditos: só entra quando eles chegam (110 + 11)
    expect(plan.periods[2].creditsBefore).toBe(133);
    expect(plan.unplanned).toEqual([]);
  });

  it('never goes below the longest chain, whatever the pace', () => {
    const plan = buildGraduationPlan(SUBJECTS, {
      completed: COMPLETED,
      credits: 200,
      cap: PACE_CREDITS.intense,
    });
    expect(plan.periods).toHaveLength(plan.graph.chain.length);
  });

  it('shifts what depends on a postponed subject', () => {
    const base = { completed: COMPLETED, credits: 200, cap: 26 };
    const plan = buildGraduationPlan(SUBJECTS, base);
    const later = buildGraduationPlan(SUBJECTS, {
      ...base,
      notBefore: new Map([['1', 1]]),
    });
    expect(later.periodOf.get('1')).toBe(1);
    expect(later.periods.length).toBe(plan.periods.length + 1);
    // adiar o que não trava nada não muda o fim
    const free = buildGraduationPlan(SUBJECTS, {
      ...base,
      notBefore: new Map([['8', 1]]),
    });
    expect(free.periods.length).toBe(plan.periods.length);
  });

  it('places a subject larger than the pace alone, and reports what cannot be planned', () => {
    const plan = buildGraduationPlan(
      [subject('1', 30), subject('2', 4, [['404']])],
      { completed: new Set(), credits: 0, cap: 20 },
    );
    expect(plan.periods.map(p => p.subjects.map(s => s.key))).toEqual([['1']]);
    expect(plan.unplanned.map(s => s.key)).toEqual(['2']);
  });

  it('measures the slack against the deadline from the Síntese', () => {
    const plan = buildGraduationPlan(SUBJECTS, {
      completed: COMPLETED,
      credits: 110,
      cap: 12,
    });
    expect(deadlineSlack(plan, 6)).toBe(2);
    expect(deadlineSlack(plan, 3)).toBe(-1);
    expect(deadlineSlack(plan, null)).toBeNull();
  });
});

describe('elective slots', () => {
  it('splits the missing credits in the usual size of the group', () => {
    const slots = electiveSlots('RESTRICTED', 10, 4, 'Eletiva Restrita');
    expect(slots.map(s => [s.key, s.credits])).toEqual([
      ['RESTRICTED:1', 4],
      ['RESTRICTED:2', 4],
      ['RESTRICTED:3', 2],
    ]);
    expect(slots.every(s => s.placeholder && s.kind === 'RESTRICTED')).toBe(
      true,
    );
    expect(electiveSlots('DEFINED', 0, 4, 'Eletiva Definida')).toEqual([]);
  });
});

describe('periods', () => {
  it('counts semesters across years', () => {
    expect(periodAfter('2026.1')).toBe('2026.2');
    expect(periodAfter('2026.2')).toBe('2027.1');
    expect(periodAfter('2026.1', 5)).toBe('2028.2');
    expect(periodAfter('atual')).toBeNull();
    expect(planIndexOf('2026.1', '2026.2')).toBe(0);
    expect(planIndexOf('2026.1', '2027.2')).toBe(2);
    expect(planIndexOf('2026.1', '2025.2')).toBe(-2);
  });
});
