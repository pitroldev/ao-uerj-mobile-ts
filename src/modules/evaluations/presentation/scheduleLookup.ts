import type {
  AttendedClassesSchedule,
  ClassGrade,
  Grade,
} from '@root/modules/academics/domain/models';
import { subjectKey } from '@root/modules/academics/domain/rules/subjectId';
import { fromIsoDate } from '@root/modules/attendance/domain/attendance';
import {
  hasClassTime,
  isCanceled,
  splitLocation,
  weekdayOf,
} from '@features/AttendedClassesSchedule/scheduleFormat';
import type { Evaluation, WeeklyMeeting } from '../domain/evaluations';
import type { EvaluationReminderText } from '../domain/reminders';
import { reminderBody, reminderTitle } from './evaluationText';

/** Uma disciplina do período, para anotar avaliações. */
export type CourseSubject = { id: string; name: string };

const ROOM_NOT_INFORMED = 'Sala não informada';

function keyOf(item: AttendedClassesSchedule): string {
  return subjectKey(item.class?.id ?? item.subject_id);
}

/** As disciplinas em curso: as da grade e, sem horário, as do quadro de notas. */
export function courseSubjects(
  schedule: readonly AttendedClassesSchedule[],
  grades: readonly ClassGrade[],
): CourseSubject[] {
  const subjects = new Map<string, string>();
  schedule.forEach(item => {
    const id = keyOf(item);
    if (!subjects.has(id))
      subjects.set(id, item.class?.name || item.subject_id);
  });
  grades.forEach(item => {
    const id = subjectKey(item.id);
    if (!subjects.has(id)) subjects.set(id, item.name);
  });
  return [...subjects].map(([id, name]) => ({ id, name }));
}

/** As notas do período por disciplina (`subjectKey`). */
export function gradesBySubject(
  grades: readonly ClassGrade[],
): Map<string, Grade> {
  return new Map(grades.map(item => [subjectKey(item.id), item.grades]));
}

/** As aulas semanais da disciplina, sem as canceladas e sem horário. */
export function meetingsOf(
  schedule: readonly AttendedClassesSchedule[],
  subjectId: string,
): WeeklyMeeting[] {
  return schedule
    .filter(
      item =>
        keyOf(item) === subjectId && !isCanceled(item) && hasClassTime(item),
    )
    .map(item => ({
      weekday: weekdayOf(item),
      start: item.start_time_in_minutes,
    }));
}

/**
 * A sala da aula da disciplina naquele dia ("Sala 3025 F"), se a grade
 * disser: a da aula em que o horário cai; sem nenhuma, a primeira do dia.
 */
function roomOn(
  schedule: readonly AttendedClassesSchedule[],
  subjectId: string,
  date: string,
  time: number,
): string | null {
  const weekday = fromIsoDate(date).getDay();
  const meetings = schedule
    .filter(
      entry =>
        keyOf(entry) === subjectId &&
        weekdayOf(entry) === weekday &&
        !isCanceled(entry),
    )
    .sort((a, b) => a.start_time_in_minutes - b.start_time_in_minutes);
  const item =
    meetings.find(
      entry =>
        time >= entry.start_time_in_minutes && time < entry.end_time_in_minutes,
    ) ?? meetings[0];
  if (!item) return null;
  const { room } = splitLocation(item.class?.uerjLocation);
  return room === ROOM_NOT_INFORMED ? null : room;
}

/** A sala da avaliação: a da aula daquele dia (um trabalho é só um prazo). */
export function evaluationRoom(
  schedule: readonly AttendedClassesSchedule[],
  evaluation: Pick<Evaluation, 'subjectId' | 'type' | 'date' | 'time'>,
): string | null {
  if (evaluation.type === 'work') return null;
  return roomOn(
    schedule,
    evaluation.subjectId,
    evaluation.date,
    evaluation.time,
  );
}

/** O texto dos avisos, com a sala do dia lida da grade salva. */
export function evaluationReminderText(
  schedule: readonly AttendedClassesSchedule[],
): EvaluationReminderText {
  return (evaluation, key) => ({
    title: reminderTitle(evaluation, key),
    body: reminderBody(evaluation, key, evaluationRoom(schedule, evaluation)),
  });
}
