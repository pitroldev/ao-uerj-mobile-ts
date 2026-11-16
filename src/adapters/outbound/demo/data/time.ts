/*
 * Tempos e dias no formato dos parsers do Aluno Online: a grade de "Disciplinas
 * em Curso" usa "Segunda-feira" e os tempos de TIME_VALUES; a Pesquisa de
 * Disciplinas, um objeto por dia com os tempos agrupados.
 */
import type {
  AttendedClassesSchedule,
  AttendedSubjectInfo,
  Horario,
} from '@root/modules/academics/domain/models';
import { TIME_VALUES } from '@utils/constants/time';

export type Slot =
  | 'M1'
  | 'M2'
  | 'M3'
  | 'M4'
  | 'M5'
  | 'M6'
  | 'T1'
  | 'T2'
  | 'T3'
  | 'T4'
  | 'T5'
  | 'T6'
  | 'N1'
  | 'N2'
  | 'N3'
  | 'N4'
  | 'N5';

/** 1 = segunda … 6 = sábado, como o `dayNumber` do parser. */
export type Day = 1 | 2 | 3 | 4 | 5 | 6;

export type Meeting = { day: Day; from: Slot; to: Slot };

const WEEKDAY = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
} as const;

/** Cabeçalho da grade de "Disciplinas em Curso". */
const PORTAL_DAY: Record<Day, string> = {
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
};

const ORDER = TIME_VALUES.map(time => time.periodAlias);

function slotTime(id: Slot) {
  const time = TIME_VALUES.find(value => value.periodAlias === id);
  if (!time) throw new Error(`Tempo desconhecido: ${id}`);
  return time;
}

function slotsBetween(from: Slot, to: Slot): Slot[] {
  return ORDER.slice(ORDER.indexOf(from), ORDER.indexOf(to) + 1) as Slot[];
}

/** Os horários de uma turma, como `parseHorarioArray` devolve. */
export function horario(meetings: readonly Meeting[]): Horario[] {
  return meetings.map(meeting => ({
    [WEEKDAY[meeting.day]]: [slotsBetween(meeting.from, meeting.to)],
  }));
}

/** Uma aula da grade, já com os tempos seguidos juntos (como o parser faz). */
export function scheduleEntry(
  subject: AttendedSubjectInfo,
  meeting: Meeting,
): AttendedClassesSchedule {
  const start = slotTime(meeting.from);
  const end = slotTime(meeting.to);
  return {
    class: subject,
    dayAlias: PORTAL_DAY[meeting.day],
    dayNumber: meeting.day,
    subject_id: subject.id,
    periodAlias: start.periodAlias,
    startTimeAlias: start.startTimeAlias,
    endTimeAlias: end.endTimeAlias,
    start_time_in_minutes: start.start_time_in_minutes,
    end_time_in_minutes: end.end_time_in_minutes,
  };
}

/** "dd/mm/aaaa", como o portal escreve as datas. */
export function portalDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** "dd/mm/aaaa hh:mm", a hora da atualização do RID. */
export function portalDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${portalDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
