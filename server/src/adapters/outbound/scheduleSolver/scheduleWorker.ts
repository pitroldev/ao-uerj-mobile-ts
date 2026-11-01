import { parentPort } from 'node:worker_threads';

import { generateSchedules } from '../../../modules/schedules/domain/search.ts';
import type { PoolRequest, PoolResponse } from './workerPool.ts';
import type { WorkerJob } from './threadedSolver.ts';

// O script da thread: uma busca por mensagem, e a thread fica para a próxima.
parentPort?.on('message', ({ id, data }: PoolRequest<WorkerJob>) => {
  let response: PoolResponse;
  try {
    const deadline = performance.now() + data.budgetMs;
    response = {
      id,
      result: generateSchedules(data.request, {
        shouldStop: () => performance.now() > deadline,
      }),
    };
  } catch (error) {
    response = {
      id,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  parentPort?.postMessage(response);
});
