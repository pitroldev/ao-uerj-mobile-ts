import { generateSchedules } from '../../../modules/schedules/domain/search.ts';
import type { ScheduleSolver } from '../../../modules/schedules/ports.ts';
import { systemClock, type Clock } from '../../../shared/clock.ts';

/**
 * A busca na thread de quem chama, com o mesmo orçamento: para testes e
 * scripts. Trava o processo enquanto busca; o servidor usa o `threadedSolver`.
 */
export function createInlineSolver({
  budgetMs = Number.POSITIVE_INFINITY,
  now = systemClock,
}: { budgetMs?: number; now?: Clock } = {}): ScheduleSolver {
  let running = 0;
  return {
    async solve(request, { signal } = {}) {
      signal?.throwIfAborted();
      running += 1;
      try {
        const deadline = now() + budgetMs;
        return generateSchedules(request, {
          shouldStop: () => now() > deadline,
        });
      } finally {
        running -= 1;
      }
    },
    load: () => ({ running, queued: 0 }),
  };
}
