import type {
  GenerationRequest,
  GenerationResult,
} from '../../../modules/schedules/domain/model.ts';
import type { ScheduleSolver } from '../../../modules/schedules/ports.ts';
import { UnavailableError } from '../../../shared/errors.ts';
import { createAdmission } from './admission.ts';
import { createWorkerPool } from './workerPool.ts';

/** O que a thread recebe. */
export type WorkerJob = { request: GenerationRequest; budgetMs: number };

const WORKER_URL = new URL('./scheduleWorker.ts', import.meta.url);

/** Depois do orçamento, quanto a thread tem para responder antes de ser encerrada. */
const GRACE_MS = 5000;

/**
 * Quanto um pedido espera na fila. O app (axios) e o nginx desistem aos
 * 60 s: a espera e a busca (até o orçamento) cabem em uns 50 s, e quem
 * esperaria mais recebe um 503 em JSON na hora, não o 504 do nginx.
 */
const queueWaitFor = (budgetMs: number) => Math.max(5000, 50000 - budgetMs);

const busy = () =>
  new UnavailableError(
    'generator_busy',
    'The schedule generator is busy; try again in a moment',
  );
const shuttingDown = () =>
  new UnavailableError(
    'generator_unavailable',
    'The schedule generator is shutting down',
  );
const timedOut = () =>
  new UnavailableError(
    'generator_timeout',
    'The schedule generator took too long; try again with fewer classes',
  );

/**
 * As buscas em threads (`worker_threads`), para a CPU ocupada não travar o
 * mural: `concurrency` ao mesmo tempo, `queueLimit` esperando (o resto
 * recebe 503 na hora) e `memoryMb` de heap por thread. As threads ficam
 * aquecidas entre uma busca e outra (ver workerPool.ts). A busca para
 * sozinha em `budgetMs` com o melhor que achou; a thread que não responde
 * até `graceMs` depois disso é encerrada. Quem desiste sai da fila ou
 * encerra a thread; `close` encerra todas.
 */
export function createThreadedSolver({
  concurrency,
  queueLimit,
  budgetMs,
  memoryMb = 128,
  graceMs = GRACE_MS,
  workerUrl = WORKER_URL,
}: {
  concurrency: number;
  queueLimit: number;
  budgetMs: number;
  memoryMb?: number;
  graceMs?: number;
  /** Outro script de thread, para os testes. */
  workerUrl?: URL;
}): ScheduleSolver {
  const admission = createAdmission({
    concurrency,
    queueLimit,
    maxWaitMs: queueWaitFor(budgetMs),
    whenFull: busy,
  });
  // a admissão limita as buscas juntas; o pool nunca passa de `concurrency`
  const pool = createWorkerPool({ url: workerUrl, memoryMb });
  const closing = new AbortController();

  return {
    load: () => admission.load(),

    async solve(request, { signal } = {}) {
      const deadline = new AbortController();
      const cancel = AbortSignal.any(
        [closing.signal, deadline.signal, signal].filter(
          (candidate): candidate is AbortSignal => candidate !== undefined,
        ),
      );
      cancel.throwIfAborted();
      const release = await admission.enter(cancel);
      // o prazo conta da vez, não da chegada na fila
      const timer = setTimeout(
        () => deadline.abort(timedOut()),
        budgetMs + graceMs,
      );
      try {
        return await pool.run<GenerationResult>(
          { request, budgetMs } satisfies WorkerJob,
          cancel,
        );
      } finally {
        clearTimeout(timer);
        release();
      }
    },

    async close() {
      closing.abort(shuttingDown());
      await pool.close();
    },
  };
}
