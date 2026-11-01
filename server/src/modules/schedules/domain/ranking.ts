import type { ScheduleTotals } from './metrics.ts';
import type { Priority } from './model.ts';

/**
 * Um critério de ordem (estratégia): dá a uma grade um número em que menor é
 * melhor. `byDay` diz se ele precisa das medidas por dia, as caras.
 */
export type Criterion = {
  readonly byDay: boolean;
  score(totals: ScheduleTotals): number;
};

type Measure = keyof ScheduleTotals;

const fewest = (measure: Measure, byDay = false): Criterion => ({
  byDay,
  score: totals => totals[measure],
});
const most = (measure: Measure, byDay = false): Criterion => ({
  byDay,
  score: totals => -totals[measure],
});

/** Uma estratégia por prioridade que o aluno escolhe. */
export const CRITERIA: Readonly<Record<Priority, Criterion>> = {
  MOST_SUBJECTS_POSSIBLE: most('count'),
  MAX_CREDITS: most('credits'),
  MAX_WORKLOAD: most('workload'),
  MIN_WORKLOAD: fewest('workload'),
  MAX_DAY_WORKLOAD: most('busiestDay', true),
  MIN_DAY_WORKLOAD: fewest('busiestDay', true),
  LIVES_FAR_AWAY: fewest('weekDays', true),
  MIN_GAPS: fewest('gapMinutes', true),
  MANDATORY_CLASSES: most('mandatory'),
  CRITICAL_FIRST: most('criticality'),
  MOST_BLOCKED_FIRST: most('blocks'),
};

/**
 * A ordem das prioridades: mais disciplinas primeiro, depois as do aluno na
 * ordem dada; uma repetida não muda nada.
 */
export const priorityOrder = (priorities: readonly Priority[]): Priority[] => [
  ...new Set<Priority>(['MOST_SUBJECTS_POSSIBLE', ...priorities]),
];

/** Os critérios compostos: o placar de uma grade, critério a critério. */
export type Ranking = {
  readonly byDay: boolean;
  score(totals: ScheduleTotals): number[];
};

export function createRanking(priorities: readonly Priority[]): Ranking {
  const criteria = priorityOrder(priorities).map(
    priority => CRITERIA[priority],
  );
  return {
    byDay: criteria.some(criterion => criterion.byDay),
    score: totals => criteria.map(criterion => criterion.score(totals)),
  };
}

/** Uma grade na ordem: o placar e quando a busca a encontrou. */
export type Placing = { score: readonly number[]; seq: number };

/**
 * `a` vem antes de `b`: decide o primeiro critério em que diferem; no
 * empate em todos, a encontrada antes.
 */
export function ranksBefore(a: Placing, b: Placing): boolean {
  for (let k = 0; k < a.score.length; k++)
    if (a.score[k] !== b.score[k]) return a.score[k] < b.score[k];
  return a.seq < b.seq;
}
