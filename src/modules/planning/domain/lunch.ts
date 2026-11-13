import type { Schedule } from './models';

/**
 * Horário de almoço: em cada dia com aula, um trecho livre de pelo menos
 * `minutes` dentro da janela (minutos desde a meia-noite, fim exclusivo). É
 * a mesma regra que o gerador aplica no servidor.
 */
export type LunchBreak = { start: number; end: number; minutes: number };

/** A janela do almoço na UERJ: os tempos M6, T1 e T2 (11:30 às 14:10). */
export const LUNCH_WINDOW = { start: 690, end: 850 } as const;

/**
 * As durações que o aluno escolhe: um tempo livre (o M6 e o T2 têm 50 min)
 * ou dois tempos seguidos (M6 com T1, ou T1 com T2: 1h50).
 */
export const LUNCH_MINUTES = { oneSlot: 50, twoSlots: 100 } as const;

/** A restrição do almoço para o pedido, ou `null` com ele desligado. */
export function lunchBreak(
  minutes: number | null | undefined,
): LunchBreak | null {
  if (!minutes || !Number.isFinite(minutes) || minutes <= 0) return null;
  const span = LUNCH_WINDOW.end - LUNCH_WINDOW.start;
  return { ...LUNCH_WINDOW, minutes: Math.min(Math.round(minutes), span) };
}

/** O maior trecho livre da janela, tiradas as aulas de um dia. */
function longestFreeStretch(
  day: readonly Schedule[],
  lunch: LunchBreak,
): number {
  const taken = day
    .map(item => ({
      start: Math.max(item.start_time_in_minutes, lunch.start),
      end: Math.min(item.end_time_in_minutes, lunch.end),
    }))
    .filter(item => item.start < item.end)
    .sort((a, b) => a.start - b.start);
  let cursor = lunch.start;
  let longest = 0;
  for (const item of taken) {
    longest = Math.max(longest, item.start - cursor);
    cursor = Math.max(cursor, item.end);
  }
  return Math.max(longest, lunch.end - cursor);
}

/**
 * Os dias (0 = segunda) em que as aulas não deixam o almoço. Um dia sem aula
 * na janela nunca entra.
 */
export function daysWithoutLunch(
  intervals: readonly Schedule[],
  lunch: LunchBreak,
): number[] {
  const byDay = new Map<number, Schedule[]>();
  for (const item of intervals) {
    const day = byDay.get(item.week_day) ?? [];
    day.push(item);
    byDay.set(item.week_day, day);
  }
  return [...byDay.entries()]
    .filter(([, day]) => longestFreeStretch(day, lunch) < lunch.minutes)
    .map(([weekDay]) => weekDay)
    .sort((a, b) => a - b);
}

/** As aulas deixam o almoço em todos os dias. */
export const leavesLunch = (
  intervals: readonly Schedule[],
  lunch: LunchBreak,
): boolean => daysWithoutLunch(intervals, lunch).length === 0;
