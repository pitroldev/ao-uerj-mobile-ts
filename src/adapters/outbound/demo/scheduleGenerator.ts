import type {
  GenerationOptions,
  ScheduleGenerationRequest,
  ScheduleGeneratorPort,
} from '@root/modules/planning/application/ports';
import type {
  GeneratedClassWithSubject,
  GeneratedSchedule,
  Priority,
  Schedule,
} from '@root/modules/planning/domain/models';
import { hasScheduleConflict } from '@root/modules/planning/domain/rules';
import { toGeneratorPayload } from '../schedule-generator/mappers';
import { wait } from './wait';

const MAX_RESULTS = 3;
/** Bounds the search; the demo dataset needs far fewer visits. */
const MAX_VISITS = 50_000;

function dailyMinutes(schedules: Schedule[]) {
  const byDay = new Map<number, Schedule[]>();
  schedules.forEach(item =>
    byDay.set(item.week_day, [...(byDay.get(item.week_day) ?? []), item]),
  );
  return [...byDay.values()].map(items => {
    const sorted = [...items].sort(
      (a, b) => a.start_time_in_minutes - b.start_time_in_minutes,
    );
    const busy = sorted.reduce(
      (sum, item) =>
        sum + item.end_time_in_minutes - item.start_time_in_minutes,
      0,
    );
    const gaps = sorted
      .slice(1)
      .reduce(
        (sum, item, index) =>
          sum +
          Math.max(
            0,
            item.start_time_in_minutes - sorted[index].end_time_in_minutes,
          ),
        0,
      );
    return { busy, gaps };
  });
}

function summarize(schedule: GeneratedClassWithSubject[]): GeneratedSchedule {
  const intervals = schedule.flatMap(group => group.schedules);
  const days = dailyMinutes(intervals);
  return {
    schedule,
    total_week_days: days.length,
    total_gaps_in_minutes: days.reduce((sum, day) => sum + day.gaps, 0),
    total_credits: schedule.reduce(
      (sum, group) => sum + group.subject.credits,
      0,
    ),
    total_workload: schedule.reduce(
      (sum, group) => sum + group.subject.total_workload,
      0,
    ),
    hash: `demo-${schedule
      .map(group => `${group.subject_id}:${group.id}`)
      .sort()
      .join('|')}`,
  };
}

type Ranked = { result: GeneratedSchedule; maxDay: number; mandatory: number };

const comparators: Record<Priority, (a: Ranked, b: Ranked) => number> = {
  MOST_SUBJECTS_POSSIBLE: (a, b) =>
    b.result.schedule.length - a.result.schedule.length,
  MAX_CREDITS: (a, b) => b.result.total_credits - a.result.total_credits,
  MIN_GAPS: (a, b) =>
    a.result.total_gaps_in_minutes - b.result.total_gaps_in_minutes,
  LIVES_FAR_AWAY: (a, b) => a.result.total_week_days - b.result.total_week_days,
  MAX_WORKLOAD: (a, b) => b.result.total_workload - a.result.total_workload,
  MIN_WORKLOAD: (a, b) => a.result.total_workload - b.result.total_workload,
  MAX_DAY_WORKLOAD: (a, b) => b.maxDay - a.maxDay,
  MIN_DAY_WORKLOAD: (a, b) => a.maxDay - b.maxDay,
  MANDATORY_CLASSES: (a, b) => b.mandatory - a.mandatory,
  CRITICAL_FIRST: (a, b) => {
    const period = (item: Ranked) =>
      item.result.schedule.reduce(
        (sum, group) => sum + (group.subject.recomended_period ?? 10),
        0,
      ) / Math.max(1, item.result.schedule.length);
    return period(a) - period(b);
  },
};

/** Local, deterministic stand-in for the remote generator (demo only). */
export function generateDemoSchedules(
  request: ScheduleGenerationRequest,
): GeneratedSchedule[] {
  const payload = toGeneratorPayload(request);
  const { min_subject_amount: minimum, max_subject_amount: maximum } =
    payload.preferences;
  const options = payload.subjects
    .map(subject => ({
      subject,
      classes: payload.classes
        .filter(group => group.subject_id === subject.id)
        .map(({ selected_by_user: _ignored, ...group }) => ({
          ...group,
          subject,
        })),
    }))
    .filter(option => option.classes.length > 0);

  const found: GeneratedClassWithSubject[][] = [];
  let visits = 0;
  const search = (index: number, chosen: GeneratedClassWithSubject[]) => {
    visits += 1;
    if (visits > MAX_VISITS || chosen.length > maximum) return;
    if (index === options.length) {
      if (chosen.length >= minimum) found.push(chosen);
      return;
    }
    const busy = chosen.flatMap(group => group.schedules);
    options[index].classes.forEach(group => {
      if (!hasScheduleConflict(group.schedules, busy))
        search(index + 1, [...chosen, group]);
    });
    search(index + 1, chosen);
  };
  search(0, []);

  const ranked: Ranked[] = found.map(schedule => {
    const result = summarize(schedule);
    return {
      result,
      maxDay: Math.max(
        0,
        ...dailyMinutes(schedule.flatMap(group => group.schedules)).map(
          day => day.busy,
        ),
      ),
      mandatory: schedule.filter(group => group.subject.type === 'MANDATORY')
        .length,
    };
  });
  // Like the legacy server: subject count first, then the chosen priorities.
  const order: Priority[] = [
    'MOST_SUBJECTS_POSSIBLE',
    ...payload.preferences.priority,
  ];
  ranked.sort((a, b) => {
    for (const priority of order) {
      const difference = comparators[priority](a, b);
      if (difference !== 0) return difference;
    }
    return a.result.hash.localeCompare(b.result.hash);
  });
  return ranked.slice(0, MAX_RESULTS).map(item => item.result);
}

export function createDemoScheduleGenerator(
  latencyMs: number,
): ScheduleGeneratorPort {
  return {
    async generate(request, options?: GenerationOptions) {
      await wait(latencyMs, options?.signal);
      return generateDemoSchedules(request);
    },
  };
}
