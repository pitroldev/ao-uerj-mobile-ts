import type { Grade } from '@root/modules/academics/domain/models';
import {
  finalExamOutlook,
  type FinalExamOutlook,
} from '@root/modules/academics/domain/rules/finalExam';
import {
  fromIsoDate,
  toIsoDate,
} from '@root/modules/attendance/domain/attendance';

/** Provas da UERJ: uma de cada por disciplina, e a nota sai no portal. */
const EXAM_TYPES = ['P1', 'P2', 'PF'] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

export const EVALUATION_TYPES = [
  ...EXAM_TYPES,
  'work',
  'seminar',
  'other',
] as const;
export type EvaluationType = (typeof EVALUATION_TYPES)[number];

/**
 * Antecedências dos lembretes. As de dias saem no horário dos avisos de dias
 * antes; "No dia", no horário do dia; as de horas, antes do início.
 */
export const REMINDER_KEYS = [
  'week',
  'three',
  'eve',
  'day',
  'h2',
  'h1',
  'm30',
] as const;
export type ReminderKey = (typeof REMINDER_KEYS)[number];

type ReminderRule =
  | { kind: 'days'; days: number }
  | { kind: 'day' }
  | { kind: 'minutes'; minutes: number };

const REMINDER_RULES: Record<ReminderKey, ReminderRule> = {
  week: { kind: 'days', days: 7 },
  three: { kind: 'days', days: 3 },
  eve: { kind: 'days', days: 1 },
  day: { kind: 'day' },
  h2: { kind: 'minutes', minutes: 120 },
  h1: { kind: 'minutes', minutes: 60 },
  m30: { kind: 'minutes', minutes: 30 },
};

/** Lembretes que saem no horário dos avisos de dias antes. */
export const EARLY_REMINDERS: readonly ReminderKey[] = REMINDER_KEYS.filter(
  key => REMINDER_RULES[key].kind === 'days',
);

export const DEFAULT_REMINDERS: readonly ReminderKey[] = ['eve', 'day'];
/** Avisos de dias antes às 20h e o do dia às 7h. */
export const DEFAULT_EARLY_TIME = 20 * 60;
export const DEFAULT_DAY_TIME = 7 * 60;
/** Trabalhos começam com o prazo às 23:59. */
export const WORK_DEADLINE = 23 * 60 + 59;
export const NOTE_MAX = 500;

/** Uma prova ou trabalho anotado pelo aluno (registro local, só no aparelho). */
export type Evaluation = {
  id: string;
  /** Código numérico da disciplina (o de `subjectKey`). */
  subjectId: string;
  /** Nome quando foi anotada: o lembrete sai mesmo sem a grade salva. */
  subjectName: string;
  type: EvaluationType;
  /** Dia, "AAAA-MM-DD" no fuso do aparelho. */
  date: string;
  /** Início (ou prazo, num trabalho), em minutos desde 00:00. */
  time: number;
  note: string;
  reminders: ReminderKey[];
  /** Horário dos lembretes de dias antes, em minutos desde 00:00. */
  earlyTime: number;
  /** Horário do lembrete "No dia", em minutos desde 00:00. */
  dayTime: number;
  /** "Já fiz", tocado no aviso: sai das próximas e os lembretes param. */
  done: boolean;
};

/** Os campos que decidem quando a avaliação e os lembretes acontecem. */
type Timing = Pick<
  Evaluation,
  'date' | 'time' | 'reminders' | 'earlyTime' | 'dayTime'
>;

/** Aula semanal de uma disciplina: dia da semana do JS (0 = domingo) e minutos. */
export type WeeklyMeeting = { weekday: number; start: number };

const MINUTE = 60 * 1000;
const DAY_MINUTES = 24 * 60;

export function isExam(type: EvaluationType): type is ExamType {
  return (EXAM_TYPES as readonly string[]).includes(type);
}

/** A nota da prova no quadro do período, se já saiu. */
export function examGrade(
  type: ExamType,
  grades: Grade | undefined,
): number | null {
  if (!grades) return null;
  let value: unknown = grades.pf;
  if (type === 'P1') value = grades.p1;
  if (type === 'P2') value = grades.p2;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function hasGrade(type: ExamType, grades: Grade | undefined): boolean {
  return examGrade(type, grades) !== null;
}

function at(date: string, minutes: number): Date {
  const day = fromIsoDate(date);
  day.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return day;
}

/** Início da avaliação (o prazo, num trabalho). */
export function startOf(evaluation: Pick<Evaluation, 'date' | 'time'>): Date {
  return at(evaluation.date, evaluation.time);
}

/** Quando o lembrete `key` da avaliação chega. */
export function reminderAt(evaluation: Timing, key: ReminderKey): Date {
  const rule = REMINDER_RULES[key];
  if (rule.kind === 'days') {
    const day = fromIsoDate(evaluation.date);
    day.setDate(day.getDate() - rule.days);
    return at(toIsoDate(day), evaluation.earlyTime);
  }
  if (rule.kind === 'day') return at(evaluation.date, evaluation.dayTime);
  return new Date(startOf(evaluation).getTime() - rule.minutes * MINUTE);
}

/** O lembrete chega antes do início da avaliação ("No dia" às 7h de uma prova às 6h não). */
export function remindsBeforeStart(
  evaluation: Timing,
  key: ReminderKey,
): boolean {
  return reminderAt(evaluation, key) < startOf(evaluation);
}

/** O lembrete ainda vai chegar: depois de agora e antes do início. */
export function remindsLater(
  evaluation: Timing,
  key: ReminderKey,
  now: Date,
): boolean {
  return (
    reminderAt(evaluation, key) > now && remindsBeforeStart(evaluation, key)
  );
}

/** Os lembretes escolhidos, do primeiro ao último a chegar. */
export function sortedReminders(evaluation: Timing): ReminderKey[] {
  return REMINDER_KEYS.filter(key => evaluation.reminders.includes(key)).sort(
    (a, b) =>
      reminderAt(evaluation, a).getTime() - reminderAt(evaluation, b).getTime(),
  );
}

/** Os lembretes que ainda vão chegar, na ordem. */
export function comingReminders(evaluation: Timing, now: Date): ReminderKey[] {
  return sortedReminders(evaluation).filter(key =>
    remindsLater(evaluation, key, now),
  );
}

/** Ainda não começou (ou o prazo não venceu). */
function isAhead(
  evaluation: Pick<Evaluation, 'date' | 'time'>,
  now: Date,
): boolean {
  return startOf(evaluation) >= now;
}

export type GradesBySubject = ReadonlyMap<string, Grade>;

/** Situações em que não há PF pela frente: dispensado, sem direito, feita ou média publicada. */
const NO_FINAL_EXAM = new Set<FinalExamOutlook['kind']>([
  'exempt',
  'no-final-exam',
  'final-exam-done',
  'published',
]);

/**
 * A nota manda: a prova cuja nota saiu no portal, ou a PF que deixou de
 * acontecer (dispensa, sem direito, média publicada), não vale mais. Some do
 * Início, da semana e dos lembretes.
 */
export function isSettled(
  evaluation: Pick<Evaluation, 'subjectId' | 'type'>,
  grades: GradesBySubject,
): boolean {
  if (!isExam(evaluation.type)) return false;
  const subject = grades.get(evaluation.subjectId);
  if (hasGrade(evaluation.type, subject)) return true;
  if (!subject) return false;
  const outlook = finalExamOutlook(subject).kind;
  return (
    outlook === 'published' ||
    (evaluation.type === 'PF' && NO_FINAL_EXAM.has(outlook))
  );
}

function byStart(a: Evaluation, b: Evaluation): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.time - b.time;
}

/**
 * As próximas avaliações, da mais perto para a mais longe: sem as que já
 * começaram, as feitas e as que a nota já resolveu.
 */
export function upcomingEvaluations(
  evaluations: readonly Evaluation[],
  now: Date,
  grades: GradesBySubject,
): Evaluation[] {
  return evaluations
    .filter(
      item => !item.done && isAhead(item, now) && !isSettled(item, grades),
    )
    .sort(byStart);
}

/** As avaliações de um dia, pelo horário. */
export function evaluationsOn(
  evaluations: readonly Evaluation[],
  date: string,
): Evaluation[] {
  return evaluations.filter(item => item.date === date).sort(byStart);
}

/**
 * A avaliação que acontece nesta aula da disciplina: no mesmo dia e com o
 * início dentro do horário dela (`start` até `end`, em minutos). Com duas
 * aulas no dia, só a da prova a mostra. Trabalhos são prazos, não acontecem
 * em aula.
 */
export function classEvaluation(
  evaluations: readonly Evaluation[],
  subjectId: string,
  date: string,
  meeting: { start: number; end: number },
): Evaluation | null {
  return (
    evaluationsOn(evaluations, date).find(
      item =>
        item.subjectId === subjectId &&
        item.type !== 'work' &&
        !item.done &&
        item.time >= meeting.start &&
        item.time < meeting.end,
    ) ?? null
  );
}

/** A outra P1 (P2, PF) já anotada da mesma disciplina, que a nova substitui. */
export function duplicateOf(
  evaluations: readonly Evaluation[],
  draft: Pick<Evaluation, 'subjectId' | 'type'> & { id: string | null },
): Evaluation | null {
  if (!isExam(draft.type)) return null;
  return (
    evaluations.find(
      item =>
        item.id !== draft.id &&
        item.subjectId === draft.subjectId &&
        item.type === draft.type,
    ) ?? null
  );
}

/** Grava a avaliação: troca a de mesmo id e a prova repetida da disciplina. */
export function setEvaluation(
  evaluations: readonly Evaluation[],
  evaluation: Evaluation,
): Evaluation[] {
  const duplicate = duplicateOf(evaluations, evaluation);
  const rest = evaluations.filter(
    item => item.id !== evaluation.id && item.id !== duplicate?.id,
  );
  return [...rest, evaluation];
}

export function removeEvaluation(
  evaluations: readonly Evaluation[],
  id: string,
): Evaluation[] {
  return evaluations.filter(item => item.id !== id);
}

/** "Já fiz" (ou desfazer): os lembretes param e a avaliação sai das próximas. */
export function markDone(
  evaluations: readonly Evaluation[],
  ids: readonly string[],
  done: boolean,
): Evaluation[] {
  return evaluations.map(item =>
    ids.includes(item.id) ? { ...item, done } : item,
  );
}

/**
 * As próximas `count` aulas da disciplina nos próximos `days` dias, como
 * "AAAA-MM-DD"; a de hoje só se ainda não começou.
 */
export function upcomingClassDates(
  meetings: readonly WeeklyMeeting[],
  now: Date,
  count = 4,
  days = 28,
): string[] {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const dates: string[] = [];
  for (let offset = 0; offset < days && dates.length < count; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    day.setDate(day.getDate() + offset);
    const meets = meetings.some(
      item =>
        item.weekday === day.getDay() &&
        (offset > 0 || item.start > nowMinutes),
    );
    if (meets) dates.push(toIsoDate(day));
  }
  return dates;
}

/** A primeira aula da disciplina naquele dia, se houver. */
export function meetingOn(
  meetings: readonly WeeklyMeeting[],
  date: string,
): WeeklyMeeting | null {
  const weekday = fromIsoDate(date).getDay();
  return (
    meetings
      .filter(item => item.weekday === weekday)
      .sort((a, b) => a.start - b.start)[0] ?? null
  );
}

/**
 * Tipo de uma avaliação nova: a primeira prova (P1, P2) sem nota e sem data
 * anotada; sem nenhuma, um trabalho.
 */
export function defaultType(
  evaluations: readonly Evaluation[],
  subjectId: string,
  grades: GradesBySubject,
): EvaluationType {
  const free = (['P1', 'P2'] as const).find(
    type =>
      !hasGrade(type, grades.get(subjectId)) &&
      !evaluations.some(
        item => item.subjectId === subjectId && item.type === type,
      ),
  );
  return free ?? 'work';
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isMinute(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < DAY_MINUTES
  );
}

/** Lê a cópia salva sem confiar no formato. */
export function isEvaluation(value: unknown): value is Evaluation {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    typeof item.subjectId === 'string' &&
    item.subjectId.length > 0 &&
    typeof item.subjectName === 'string' &&
    (EVALUATION_TYPES as readonly unknown[]).includes(item.type) &&
    typeof item.date === 'string' &&
    DATE.test(item.date) &&
    isMinute(item.time) &&
    typeof item.note === 'string' &&
    Array.isArray(item.reminders) &&
    item.reminders.every(key =>
      (REMINDER_KEYS as readonly unknown[]).includes(key),
    ) &&
    isMinute(item.earlyTime) &&
    isMinute(item.dayTime) &&
    typeof item.done === 'boolean'
  );
}
