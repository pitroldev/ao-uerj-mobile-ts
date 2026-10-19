const PERIOD = /^(\d{4})\.([12])$/;

function ordinal(label: string): number | null {
  const match = PERIOD.exec(label);
  return match ? Number(match[1]) * 2 + Number(match[2]) - 1 : null;
}

function fromOrdinal(value: number): string {
  return `${Math.floor(value / 2)}.${(value % 2) + 1}`;
}

/** "2026.1" → "2026.2" → "2027.1"; `null` fora do formato. */
export function periodAfter(label: string, steps = 1): string | null {
  const value = ordinal(label);
  return value === null ? null : fromOrdinal(value + steps);
}

/**
 * Índice no plano (que começa no período seguinte a `current`) do período
 * `label`; negativo se já passou, `null` fora do formato.
 */
export function planIndexOf(current: string, label: string): number | null {
  const from = ordinal(current);
  const to = ordinal(label);
  return from === null || to === null ? null : to - from - 1;
}
