import { buildCatalog, scheduleIdentity, type Candidate } from './catalog.ts';
import { createLeaderboard } from './leaderboard.ts';
import { createMeter, type Meter } from './metrics.ts';
import {
  minimumOf,
  noSchedules,
  RESULT_LIMIT,
  type GeneratedSchedule,
  type GenerationRequest,
  type GenerationResult,
} from './model.ts';
import { createRanking } from './ranking.ts';

export type SearchOptions = {
  /** Consultada de tempos em tempos: `true` encerra com o melhor achado até ali. */
  shouldStop?: () => boolean;
};

/** De quantas em quantas combinações a busca pergunta se deve parar. */
const STOP_CHECK_EVERY = 4096;

/**
 * As melhores grades do pedido (até `RESULT_LIMIT`): as mesmas, na mesma
 * ordem, que o servidor antigo devolvia. As regras estão em
 * `compatibility.ts` (o que cabe junto), `catalog.ts` (o que entra e a
 * identidade da grade) e `ranking.ts` (a ordem).
 *
 * É uma busca em profundidade nas combinações, na ordem das turmas do
 * pedido, com poda: um ramo que não alcança o mínimo, ou o número de
 * disciplinas da última grade do placar, não é visitado. O servidor antigo
 * guardava todas as combinações antes de ordenar; o resultado é o mesmo.
 */
export function generateSchedules(
  request: GenerationRequest,
  { shouldStop = () => false }: SearchOptions = {},
): GenerationResult {
  const minimum = minimumOf(request);
  const maximum = request.maxSubjects;
  const hasLunch = request.lunch !== undefined;
  const catalog = buildCatalog(request);
  const { candidates } = catalog;
  if (!candidates.length || maximum < minimum) return noSchedules();

  const ranking = createRanking(request.priorities);
  const board = createLeaderboard<Candidate[]>(RESULT_LIMIT);
  const measure = createMeter();
  const chosen: Candidate[] = [];
  let visited = 0;
  let stopped = false;

  /** A grade de agora entra no placar, se for boa o bastante. */
  function offer() {
    if (chosen.length < board.floor()) return;
    const placing = {
      score: ranking.score(measure(chosen, ranking.byDay)),
      seq: visited,
    };
    if (!board.admits(placing)) return;
    board.add({
      ...placing,
      count: chosen.length,
      identity: scheduleIdentity(chosen),
      value: [...chosen],
    });
  }

  /** Um ramo a partir desta posição ainda pode dar uma grade que entra. */
  const promising = (from: number) => {
    const reachable = chosen.length + catalog.subjectsFrom(from);
    return reachable >= minimum && reachable >= board.floor();
  };

  const fitsChosen = (position: number) =>
    chosen.every(option => catalog.compatible(option.position, position));

  function visit(from: number) {
    visited += 1;
    if (visited % STOP_CHECK_EVERY === 0 && shouldStop()) stopped = true;
    if (stopped) return;

    if (chosen.length >= minimum) offer();
    if (chosen.length === maximum) return;

    for (let next = from; next < candidates.length; next++) {
      if (stopped || !promising(next)) return;
      if (!fitsChosen(next)) continue;
      if (hasLunch && !catalog.keepsLunchBreak(chosen, next)) continue;
      chosen.push(candidates[next]);
      visit(next + 1);
      chosen.pop();
    }
  }

  visit(0);

  return {
    schedules: board
      .standings()
      .map(standing => toSchedule(standing.value, standing.identity, measure)),
    exhaustive: !stopped,
    visited,
  };
}

function toSchedule(
  classes: readonly Candidate[],
  identity: string,
  measure: Meter,
): GeneratedSchedule {
  const totals = measure(classes, true);
  return {
    classes: classes.map(({ classIndex, subjectIndex }) => ({
      classIndex,
      subjectIndex,
    })),
    hash: identity,
    weekDays: totals.weekDays,
    gapMinutes: totals.gapMinutes,
    credits: totals.credits,
    workload: totals.workload,
  };
}
