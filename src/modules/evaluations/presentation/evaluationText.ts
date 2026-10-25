import { fromIsoDate } from '@root/modules/attendance/domain/attendance';
import {
  dateLabel,
  WEEKDAY_SHORT,
} from '@features/AttendedClassesSchedule/scheduleFormat';
import {
  EARLY_REMINDERS,
  isExam,
  type Evaluation,
  type EvaluationType,
  type ReminderKey,
} from '../domain/evaluations';

/** Rótulo do tipo nos chips e nas etiquetas. */
export const TYPE_LABEL: Record<EvaluationType, string> = {
  P1: 'P1',
  P2: 'P2',
  PF: 'PF',
  work: 'Trabalho',
  seminar: 'Seminário',
  other: 'Outra',
};

export const REMINDER_LABEL: Record<ReminderKey, string> = {
  week: '1 semana antes',
  three: '3 dias antes',
  eve: 'Na véspera',
  day: 'No dia',
  h2: '2 h antes',
  h1: '1 h antes',
  m30: '30 min antes',
};

/** O começo do título do aviso. */
const REMINDER_LEAD: Record<Exclude<ReminderKey, 'day'>, string> = {
  week: 'Em 1 semana',
  three: 'Em 3 dias',
  eve: 'Amanhã',
  h2: 'Em 2 horas',
  h1: 'Em 1 hora',
  m30: 'Em 30 minutos',
};

/** "8:00", "23:59" (o formato dos tempos da UERJ). */
function clock(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

/** "P1", "Entrega do trabalho", "Seminário", "Avaliação". */
export function evaluationName(evaluation: Pick<Evaluation, 'type'>): string {
  if (isExam(evaluation.type)) return evaluation.type;
  if (evaluation.type === 'work') return 'Entrega do trabalho';
  if (evaluation.type === 'seminar') return 'Seminário';
  return 'Avaliação';
}

/** "P1 de Física III". */
export function evaluationTitle(
  evaluation: Pick<Evaluation, 'type' | 'subjectName'>,
): string {
  return `${evaluationName(evaluation)} de ${evaluation.subjectName}`;
}

/** "8:00", ou "até 23:59" num trabalho. */
export function whenText(
  evaluation: Pick<Evaluation, 'type' | 'time'>,
): string {
  const time = clock(evaluation.time);
  return evaluation.type === 'work' ? `até ${time}` : time;
}

function dayCount(date: string, now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round(
    (fromIsoDate(date).getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
}

/** "Hoje", "Amanhã", "Em 4 dias". */
export function countdown(date: string, now: Date): string {
  const days = dayCount(date, now);
  if (days <= 0) return 'Hoje';
  if (days === 1) return 'Amanhã';
  return `Em ${days} dias`;
}

/** 0 para hoje, 1 para amanhã, e assim por diante. */
export function daysUntil(date: string, now: Date): number {
  return dayCount(date, now);
}

/** "Seg, 23/11". */
export function shortDate(date: string): string {
  const day = fromIsoDate(date);
  return `${WEEKDAY_SHORT[day.getDay()]}, ${day.getDate()}/${day.getMonth() + 1}`;
}

/** "24/11", na célula do quadro de notas. */
export function dayMonth(date: string): string {
  const day = fromIsoDate(date);
  return `${String(day.getDate()).padStart(2, '0')}/${String(
    day.getMonth() + 1,
  ).padStart(2, '0')}`;
}

/** "Terça, 24 de novembro". */
export function longDate(date: string): string {
  return dateLabel(fromIsoDate(date));
}

/** "Seg, 23/11, 20:00". */
export function dateTimeText(date: Date): string {
  return `${WEEKDAY_SHORT[date.getDay()]}, ${date.getDate()}/${
    date.getMonth() + 1
  }, ${clock(date.getHours() * 60 + date.getMinutes())}`;
}

/** "1 lembrete", "3 lembretes". */
export function reminderCount(count: number): string {
  return `${count} ${count === 1 ? 'lembrete' : 'lembretes'}`;
}

/** Título do aviso: "Amanhã: P1 de Física III", "Hoje, 8:00: …". */
export function reminderTitle(
  evaluation: Pick<Evaluation, 'type' | 'subjectName' | 'time'>,
  key: ReminderKey,
): string {
  const lead =
    key === 'day' ? `Hoje, ${whenText(evaluation)}` : REMINDER_LEAD[key];
  return `${lead}: ${evaluationTitle(evaluation)}`;
}

/**
 * Corpo do aviso: o dia (nos de dias antes), o horário (nos de horas), a
 * sala e a observação, separados por " · ".
 */
export function reminderBody(
  evaluation: Pick<Evaluation, 'type' | 'date' | 'time' | 'note'>,
  key: ReminderKey,
  room: string | null,
): string {
  let when = '';
  if (EARLY_REMINDERS.includes(key))
    when = `${longDate(evaluation.date)}, ${whenText(evaluation)}`;
  else if (key !== 'day') when = whenText(evaluation);
  return [when, room, evaluation.note.trim()].filter(Boolean).join(' · ');
}
