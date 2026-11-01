/** O relógio dos casos de uso: ms desde 1970. Os testes passam o próprio. */
export type Clock = () => number;

export const systemClock: Clock = () => Date.now();

/**
 * Guarda o resultado de `load` por `ttlMs`; quem pede durante a busca espera
 * a mesma promessa. Uma falha não fica guardada.
 */
export function cacheFor<T>(
  load: () => Promise<T>,
  { ttlMs, now = systemClock }: { ttlMs: number; now?: Clock },
): { get: () => Promise<T> } {
  let entry: { value: Promise<T>; expiresAt: number } | null = null;

  return {
    get() {
      if (entry && entry.expiresAt > now()) return entry.value;
      const value = load();
      const current = { value, expiresAt: now() + ttlMs };
      entry = current;
      value.catch(() => {
        if (entry === current) entry = null;
      });
      return value;
    },
  };
}
