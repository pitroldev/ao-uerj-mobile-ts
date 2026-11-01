import type { GeneratorLoad } from '../../../modules/schedules/ports.ts';
import { reasonOf } from './cancellation.ts';

/** Libera a vaga; chamar de novo não faz nada. */
export type Release = () => void;

/**
 * Um compartimento (bulkhead) para trabalho pesado: `concurrency` rodando e
 * até `queueLimit` esperando, na ordem de chegada. Com a fila cheia, quem
 * chega é recusado na hora (`whenFull`); quem espera mais que `maxWaitMs`
 * também, e quem desiste na fila sai dela.
 */
export function createAdmission({
  concurrency,
  queueLimit,
  maxWaitMs = Number.POSITIVE_INFINITY,
  whenFull,
}: {
  concurrency: number;
  queueLimit: number;
  maxWaitMs?: number;
  whenFull: () => Error;
}) {
  let running = 0;
  const waiting: (() => void)[] = [];

  function occupy(): Release {
    running += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      running -= 1;
      waiting.shift()?.();
    };
  }

  return {
    load: (): GeneratorLoad => ({ running, queued: waiting.length }),

    /** Espera a vez e devolve como liberá-la. O `signal` tira da fila. */
    enter(signal: AbortSignal): Promise<Release> {
      if (signal.aborted) return Promise.reject(reasonOf(signal));
      if (running < concurrency) return Promise.resolve(occupy());
      if (waiting.length >= queueLimit) return Promise.reject(whenFull());
      return new Promise((resolve, reject) => {
        let timer: NodeJS.Timeout | undefined;
        const leave = () => {
          const at = waiting.indexOf(turn);
          if (at !== -1) waiting.splice(at, 1);
          signal.removeEventListener('abort', giveUp);
          clearTimeout(timer);
        };
        const turn = () => {
          leave();
          resolve(occupy());
        };
        const giveUp = () => {
          leave();
          reject(reasonOf(signal));
        };
        waiting.push(turn);
        signal.addEventListener('abort', giveUp, { once: true });
        if (Number.isFinite(maxWaitMs))
          timer = setTimeout(() => {
            leave();
            reject(whenFull());
          }, maxWaitMs);
      });
    },
  };
}
