import { AppError } from '@root/shared/errors/AppError';

/** O atraso de uma resposta da demo: o bastante para os estados de carregamento aparecerem. */
const LATENCY_MS = 250;

/**
 * O relógio da conta de demonstração. Períodos e datas são contados a partir
 * de hoje, para a conta nunca ficar velha: o período corrente é AAAA.1 de
 * janeiro a julho e AAAA.2 de agosto a dezembro.
 */
export type DemoClock = {
  now(): number;
  /** "AAAA.S": o período corrente, ou `back` períodos antes dele. */
  period(back?: number): string;
  /** Um instante a `days` dias de hoje (negativo, no passado), às `hour` horas. */
  daysFromNow(days: number, hour?: number): Date;
  /** A espera de uma resposta, cancelável como as do portal. */
  respond<T>(read: () => T, signal?: AbortSignal): Promise<T>;
};

export function createDemoClock(
  now: () => number,
  latencyMs = LATENCY_MS,
): DemoClock {
  const period = (back = 0) => {
    const today = new Date(now());
    // semestres desde o ano zero: o .1 é par, o .2 é ímpar
    const index =
      today.getFullYear() * 2 + (today.getMonth() >= 7 ? 1 : 0) - back;
    return `${Math.floor(index / 2)}.${(index % 2) + 1}`;
  };
  return {
    now,
    period,
    daysFromNow(days, hour = 12) {
      const date = new Date(now());
      date.setDate(date.getDate() + days);
      date.setHours(hour, 0, 0, 0);
      return date;
    },
    async respond(read, signal) {
      await wait(latencyMs, signal);
      // cópia: quem chama nunca mexe nos dados guardados
      return structuredCopy(read());
    },
  };
}

function structuredCopy<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

/** A espera simulada, que respeita o cancelamento como os adaptadores reais. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new AppError('CANCELLED'));
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AppError('CANCELLED'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
