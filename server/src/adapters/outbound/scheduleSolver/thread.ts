import { Worker } from 'node:worker_threads';

import { reasonOf } from './cancellation.ts';

/**
 * Roda o script `url` numa thread nova, com `data`, e espera a primeira
 * mensagem dela. Se o `signal` aborta, a thread é encerrada e a promessa
 * rejeita com o motivo. `memoryMb` limita o heap da thread: uma busca que
 * estoura não derruba o servidor.
 */
export function runInThread<Result>(
  url: URL,
  data: unknown,
  { signal, memoryMb }: { signal: AbortSignal; memoryMb: number },
): Promise<Result> {
  if (signal.aborted) return Promise.reject(reasonOf(signal));

  return new Promise((resolve, reject) => {
    const worker = new Worker(url, {
      workerData: data,
      resourceLimits: { maxOldGenerationSizeMb: memoryMb },
    });
    let settled = false;

    const settle = (outcome: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      void worker.terminate();
      outcome();
    };
    const abort = () => settle(() => reject(reasonOf(signal)));

    worker.once('message', (result: Result) => settle(() => resolve(result)));
    worker.once('error', error => settle(() => reject(error)));
    worker.once('exit', code =>
      settle(() =>
        reject(new Error(`The worker thread exited with code ${code}`)),
      ),
    );
    signal.addEventListener('abort', abort, { once: true });
  });
}
