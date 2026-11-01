import { Worker } from 'node:worker_threads';

import { reasonOf } from './cancellation.ts';

/** O que vai para a thread: um id para casar a resposta e os dados. */
export type PoolRequest<Data> = { id: number; data: Data };

/** O que a thread devolve: o resultado ou a mensagem do erro. */
export type PoolResponse = { id: number; result?: unknown; error?: string };

/**
 * Threads aquecidas para um script (`worker_threads`): cada uma atende uma
 * tarefa por vez e fica para a próxima, porque abrir uma thread e carregar o
 * TypeScript custa centenas de milissegundos na VM. Quem limita quantas
 * rodam juntas é quem chama (a admissão); o pool só reaproveita.
 *
 * Uma tarefa abortada (desistência, prazo, desligamento) encerra a thread
 * dela, porque a busca não tem como parar no meio; a próxima tarefa abre
 * outra. As threads não seguram o processo aberto.
 */
export function createWorkerPool({
  url,
  memoryMb,
}: {
  url: URL;
  /** O heap de cada thread: uma busca que estoura não derruba o servidor. */
  memoryMb: number;
}) {
  const idle: Worker[] = [];
  const alive = new Set<Worker>();
  let sequence = 0;

  function spawn(): Worker {
    const worker = new Worker(url, {
      resourceLimits: { maxOldGenerationSizeMb: memoryMb },
    });
    worker.unref();
    alive.add(worker);
    // Sempre um ouvinte de 'error': o heap estourado chega como 'error' na
    // saída da thread, também depois de a tarefa ter desistido dela, e um
    // 'error' sem ouvinte derrubaria o processo inteiro. Quem tem uma
    // tarefa na thread ouve o seu próprio (`onFailure`).
    worker.on('error', () => undefined);
    worker.once('exit', () => {
      alive.delete(worker);
      const at = idle.indexOf(worker);
      if (at !== -1) idle.splice(at, 1);
    });
    return worker;
  }

  function run<Result>(data: unknown, signal: AbortSignal): Promise<Result> {
    if (signal.aborted) return Promise.reject(reasonOf(signal));
    const worker = idle.pop() ?? spawn();
    const id = ++sequence;

    return new Promise<Result>((resolve, reject) => {
      let settled = false;
      const detach = () => {
        settled = true;
        worker.off('message', onMessage);
        worker.off('error', onFailure);
        worker.off('exit', onExit);
        signal.removeEventListener('abort', onAbort);
      };
      // a thread pode estar no meio da busca: só encerrando
      const discard = (error: Error) => {
        if (settled) return;
        detach();
        void worker.terminate();
        reject(error);
      };
      const onMessage = (message: PoolResponse) => {
        if (settled || message.id !== id) return;
        detach();
        idle.push(worker);
        if (message.error === undefined) resolve(message.result as Result);
        else reject(new Error(message.error));
      };
      const onFailure = (error: Error) => discard(error);
      const onExit = (code: number) =>
        discard(new Error(`The worker thread exited with code ${code}`));
      const onAbort = () => discard(reasonOf(signal));

      worker.on('message', onMessage);
      worker.on('error', onFailure);
      worker.on('exit', onExit);
      signal.addEventListener('abort', onAbort, { once: true });
      worker.postMessage({ id, data } satisfies PoolRequest<unknown>);
    });
  }

  return {
    run,
    /** Threads abertas agora (rodando ou à espera da próxima tarefa). */
    size: () => alive.size,
    async close(): Promise<void> {
      await Promise.all([...alive].map(worker => worker.terminate()));
    },
  };
}
