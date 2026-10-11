import { GeneratedSchedule } from '@root/modules/planning/domain/models';
import { AppError } from '@root/shared/errors/AppError';

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const numeric = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const text = (value: unknown): value is string => typeof value === 'string';
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(text);
const validInterval = (value: unknown) =>
  record(value) &&
  numeric(value.week_day) &&
  value.week_day <= 6 &&
  Number.isInteger(value.week_day) &&
  numeric(value.start_time_in_minutes) &&
  numeric(value.end_time_in_minutes) &&
  value.start_time_in_minutes < value.end_time_in_minutes &&
  value.end_time_in_minutes <= 1440;
const validSubject = (value: unknown) =>
  record(value) &&
  text(value.id) &&
  text(value.name) &&
  text(value.type) &&
  numeric(value.credits) &&
  numeric(value.total_workload) &&
  strings(value.prerequisites) &&
  typeof value.allow_conflict === 'boolean';
const validClass = (value: unknown) =>
  record(value) &&
  text(value.id) &&
  text(value.name) &&
  text(value.type) &&
  text(value.subject_id) &&
  strings(value.teachers) &&
  numeric(value.vacancies_amount) &&
  validSubject(value.subject) &&
  Array.isArray(value.schedules) &&
  value.schedules.every(validInterval);

export function parseGeneratorResponse(body: unknown): GeneratedSchedule[] {
  if (
    !record(body) ||
    !Array.isArray(body.data) ||
    !body.data.every(
      value =>
        record(value) &&
        text(value.hash) &&
        numeric(value.total_week_days) &&
        numeric(value.total_gaps_in_minutes) &&
        numeric(value.total_credits) &&
        numeric(value.total_workload) &&
        Array.isArray(value.schedule) &&
        value.schedule.every(validClass),
    )
  ) {
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      'O gerador retornou uma resposta inválida.',
    );
  }
  return body.data as GeneratedSchedule[];
}
