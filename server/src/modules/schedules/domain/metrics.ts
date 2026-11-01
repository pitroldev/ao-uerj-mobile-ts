import type { PlacedClass } from './compatibility.ts';
import type { Interval } from './model.ts';

/** As medidas de uma grade que as prioridades comparam. */
export type ScheduleTotals = {
  count: number;
  credits: number;
  workload: number;
  mandatory: number;
  criticality: number;
  blocks: number;
  weekDays: number;
  /** O tempo livre entre as aulas de cada dia, somado. */
  gapMinutes: number;
  /** Os minutos de aula do dia mais cheio. */
  busiestDay: number;
};

/**
 * As aulas de um dia, juntando as que se sobrepõem: o tempo livre entre
 * elas e os minutos de aula (os sobrepostos contam duas vezes, como antes).
 */
function summarizeDay(day: Interval[]): { gaps: number; minutes: number } {
  day.sort((a, b) => a.start - b.start || a.end - b.end);
  let end = day[0].end;
  let gaps = 0;
  let minutes = 0;
  for (const interval of day) {
    minutes += interval.end - interval.start;
    if (interval.start > end) gaps += interval.start - end;
    if (interval.end > end) end = interval.end;
  }
  return { gaps, minutes };
}

/**
 * Um medidor de grades. As medidas por dia (dias com aula, tempo livre, dia
 * mais cheio) são as caras: `byDay` as liga só quando a ordem precisa delas.
 * As listas por dia são reaproveitadas de uma grade para a outra, porque a
 * busca mede milhões.
 */
export function createMeter() {
  const days: Interval[][] = Array.from({ length: 7 }, () => []);

  return function measure(
    classes: readonly PlacedClass[],
    byDay: boolean,
  ): ScheduleTotals {
    const totals: ScheduleTotals = {
      count: classes.length,
      credits: 0,
      workload: 0,
      mandatory: 0,
      criticality: 0,
      blocks: 0,
      weekDays: 0,
      gapMinutes: 0,
      busiestDay: 0,
    };
    for (const { subject } of classes) {
      totals.credits += subject.credits;
      totals.workload += subject.workload;
      if (subject.mandatory) totals.mandatory += 1;
      totals.criticality += subject.criticality;
      totals.blocks += subject.blocks;
    }
    if (!byDay) return totals;

    for (const { intervals } of classes)
      for (const interval of intervals) days[interval.day].push(interval);
    for (const day of days) {
      if (!day.length) continue;
      const { gaps, minutes } = summarizeDay(day);
      totals.weekDays += 1;
      totals.gapMinutes += gaps;
      totals.busiestDay = Math.max(totals.busiestDay, minutes);
      day.length = 0;
    }
    return totals;
  };
}

export type Meter = ReturnType<typeof createMeter>;
