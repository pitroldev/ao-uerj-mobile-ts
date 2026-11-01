import { parentPort, workerData } from 'node:worker_threads';

import { generateSchedules } from '../../../modules/schedules/domain/search.ts';
import type { WorkerJob } from './threadedSolver.ts';

// O script da thread: uma busca, uma resposta, e sai.
const { request, budgetMs } = workerData as WorkerJob;
const deadline = performance.now() + budgetMs;

parentPort?.postMessage(
  generateSchedules(request, {
    shouldStop: () => performance.now() > deadline,
  }),
);
