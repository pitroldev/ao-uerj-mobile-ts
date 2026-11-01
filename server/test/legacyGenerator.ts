/*
 * O gerador que a produção roda, portado linha a linha só para comparar: o
 * class-schedule-generator 7ea21b8 com as três correções que existem só na
 * VM (o mínimo do aluno no lugar do 3, os horários ocupados repassados e o
 * choque permitido valendo nas duas ordens). Guarda todas as combinações e
 * ordena com uma passada estável por prioridade, como lá.
 */

import type {
  GenerateSchedulesRequest,
  GeneratedClass,
  GeneratedScheduleResponse,
  ScheduleInterval,
} from '../src/adapters/inbound/http/contract.ts';

type Gaps = (schedules: ScheduleInterval[]) => number;

/** O cálculo antigo: ordena pelo fim e mede de um fim ao próximo começo. */
export const legacyGaps: Gaps = schedules => {
  if (schedules.length === 0) return 0;
  const sorted = [...schedules].sort((a, b) =>
    a.end_time_in_minutes !== b.end_time_in_minutes
      ? a.end_time_in_minutes - b.end_time_in_minutes
      : a.start_time_in_minutes - b.start_time_in_minutes,
  );
  let lastEndTime = 0;
  let gapInMinutes = 0;
  for (const s of sorted) {
    if (s.start_time_in_minutes > lastEndTime && lastEndTime > 0)
      gapInMinutes += s.start_time_in_minutes - lastEndTime;
    lastEndTime = s.end_time_in_minutes;
  }
  return gapInMinutes;
};

const hasScheduleConflict = (
  target: ScheduleInterval[],
  current: ScheduleInterval[],
) =>
  current.some(s =>
    target.some(
      t =>
        s.week_day === t.week_day &&
        s.start_time_in_minutes < t.end_time_in_minutes &&
        t.start_time_in_minutes < s.end_time_in_minutes,
    ),
  );

const hasClassConflict = (target: GeneratedClass, list: GeneratedClass[]) => {
  if (target.subject.allow_conflict) return false;
  return list.some(current => {
    if (current.subject.allow_conflict) return false;
    return hasScheduleConflict(target.schedules, current.schedules);
  });
};

const hashOf = (list: GeneratedClass[]) =>
  list
    .map(
      c =>
        `${c.subject.id}x${c.schedules
          .map(
            s =>
              `D${s.week_day}-${s.start_time_in_minutes}-${s.end_time_in_minutes}`,
          )
          .join('')}`,
    )
    .sort()
    .join('-');

function getCombinations(
  classes: GeneratedClass[],
  startIndex: number,
  max: number,
  current: GeneratedClass[],
  min: number,
  combinations: GeneratedClass[][],
  ids: Set<string> = new Set(),
): void {
  if (current.length === max) {
    combinations.push(current);
    return;
  }
  if (current.length >= min) combinations.push(current);
  for (let i = startIndex; i < classes.length; i++) {
    const c = classes[i];
    if (ids.has(c.subject.id)) continue;
    if (hasClassConflict(c, current)) continue;
    getCombinations(
      classes,
      i + 1,
      max,
      [...current, c],
      min,
      combinations,
      new Set(ids).add(c.subject.id),
    );
  }
}

function dayWorkload(list: GeneratedClass[]): number {
  const days: Record<number, number> = {};
  for (const c of list)
    for (const s of c.schedules)
      days[s.week_day] =
        (days[s.week_day] ?? 0) +
        s.end_time_in_minutes -
        s.start_time_in_minutes;
  return Math.max(...Object.values(days));
}

type Legacy = GeneratedScheduleResponse;
const sum = (list: GeneratedClass[], field: 'criticality' | 'blocks') =>
  list.reduce((acc, c) => (c.subject[field] as number) + acc, 0);

const SORTS: Record<string, (a: Legacy, b: Legacy) => number> = {
  MAX_CREDITS: (a, b) => b.total_credits - a.total_credits,
  MAX_WORKLOAD: (a, b) => b.total_workload - a.total_workload,
  MIN_WORKLOAD: (a, b) => a.total_workload - b.total_workload,
  MIN_DAY_WORKLOAD: (a, b) => dayWorkload(a.schedule) - dayWorkload(b.schedule),
  MAX_DAY_WORKLOAD: (a, b) => dayWorkload(b.schedule) - dayWorkload(a.schedule),
  LIVES_FAR_AWAY: (a, b) => a.total_week_days - b.total_week_days,
  MIN_GAPS: (a, b) => a.total_gaps_in_minutes - b.total_gaps_in_minutes,
  MANDATORY_CLASSES: (a, b) =>
    b.schedule.filter(c => c.subject.type === 'MANDATORY').length -
    a.schedule.filter(c => c.subject.type === 'MANDATORY').length,
  MOST_SUBJECTS_POSSIBLE: (a, b) => b.schedule.length - a.schedule.length,
  MOST_BLOCKED_FIRST: (a, b) =>
    sum(b.schedule, 'blocks') - sum(a.schedule, 'blocks'),
  CRITICAL_FIRST: (a, b) =>
    sum(b.schedule, 'criticality') - sum(a.schedule, 'criticality'),
};

export function legacyGenerate(
  body: GenerateSchedulesRequest,
  { gaps = legacyGaps }: { gaps?: Gaps } = {},
): Legacy[] {
  const max = parseInt(String(body.preferences.max_subject_amount), 10);
  const min = parseInt(String(body.preferences.min_subject_amount), 10);
  const busy = body.preferences.busy_schedules ?? [];
  const priority: string[] = [
    'MOST_SUBJECTS_POSSIBLE',
    ...body.preferences.priority,
  ];

  const merged: GeneratedClass[] = [];
  for (const c of body.classes) {
    const subject = body.subjects.find(s => s.id === c.subject_id);
    if (subject) merged.push({ ...c, subject });
  }
  const filtered = busy.length
    ? merged.filter(c => !hasScheduleConflict(c.schedules, busy))
    : merged;

  const combinations: GeneratedClass[][] = [];
  getCombinations(filtered, 0, max, [], min, combinations);

  const generated = new Map<string, Legacy>();
  for (const schedule of combinations) {
    const hash = hashOf(schedule);
    if (generated.has(hash)) continue;
    if (schedule.length < min) continue;
    const weekDays = [
      ...new Set(schedule.flatMap(c => c.schedules.map(s => s.week_day))),
    ];
    generated.set(hash, {
      hash,
      schedule,
      total_week_days: weekDays.length,
      total_credits: schedule.reduce((acc, c) => acc + c.subject.credits, 0),
      total_workload: schedule.reduce(
        (acc, c) => acc + c.subject.total_workload,
        0,
      ),
      fails: { subject_amount: false },
      total_gaps_in_minutes: weekDays.reduce(
        (acc, day) =>
          acc +
          gaps(
            schedule.flatMap(c => c.schedules.filter(s => s.week_day === day)),
          ),
        0,
      ),
    });
  }

  let sorted = [...generated.values()];
  for (const p of priority.reverse()) {
    const sort = SORTS[p];
    if (sort) sorted = sorted.sort(sort);
  }
  return sorted.slice(0, 5);
}
