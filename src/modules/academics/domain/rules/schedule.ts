export type ScheduleInterval = {
  dayNumber: number;
  start_time_in_minutes: number;
  end_time_in_minutes: number;
};

export function schedulesConflict(
  left: ScheduleInterval,
  right: ScheduleInterval,
): boolean {
  return (
    left.dayNumber === right.dayNumber &&
    left.start_time_in_minutes < right.end_time_in_minutes &&
    right.start_time_in_minutes < left.end_time_in_minutes
  );
}

/** Sunday is 0 in JavaScript. Select the next class day, wrapping into next week. */
export function nextWeekdayIndex(
  days: readonly number[],
  today: number,
): number {
  if (!days.length) return 0;
  return days.reduce(
    (best, day, index) =>
      (day - today + 7) % 7 < (days[best] - today + 7) % 7 ? index : best,
    0,
  );
}
