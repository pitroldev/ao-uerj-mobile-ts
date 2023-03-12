import {WEEKDAY_DICTIONARY} from '@utils/constants/time';

import {GeneratedClassWithSubject, RenderedSchedule} from './types';

export function convertToRenderedSchedule(
  generatedSchedules: GeneratedClassWithSubject[],
): RenderedSchedule {
  const renderedSchedule: RenderedSchedule = {};

  generatedSchedules.forEach(generatedClass => {
    generatedClass.schedules.forEach(schedule => {
      const {week_day, start_time_in_minutes, end_time_in_minutes} = schedule;

      const weekDayDefinition =
        WEEKDAY_DICTIONARY[(week_day + 1) as keyof typeof WEEKDAY_DICTIONARY];

      const weekDayName = weekDayDefinition?.name;

      if (!renderedSchedule[weekDayName]) {
        renderedSchedule[weekDayName] = [];
      }

      renderedSchedule[weekDayName].push({
        start_time_in_minutes,
        end_time_in_minutes,
        subject: generatedClass,
        class_id: generatedClass.id,
      });
    });
  });

  Object.keys(renderedSchedule).forEach(weekDay => {
    renderedSchedule[weekDay as any].sort((a, b) => {
      return a.start_time_in_minutes - b.start_time_in_minutes;
    });
  });

  return renderedSchedule;
}
