import { minimumOf, noSchedules } from './domain/model.ts';
import type { ScheduleGenerator, ScheduleSolver } from './ports.ts';

/** O gerador de grades: um pedido sem saída responde sem ocupar o solver. */
export function createScheduleGenerator(
  solver: ScheduleSolver,
): ScheduleGenerator {
  return {
    async generate(request, options = {}) {
      options.signal?.throwIfAborted();
      if (!request.classes.length || request.maxSubjects < minimumOf(request))
        return noSchedules();
      return solver.solve(request, options);
    },
    load: () => solver.load(),
  };
}
