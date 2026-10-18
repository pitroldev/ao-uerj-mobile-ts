import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import { splitLocation } from '@features/AttendedClassesSchedule/scheduleFormat';
import type { ReminderText } from '../domain/classReminders';

/**
 * Texto do lembrete, com a sala antes do resto do local, como na próxima
 * aula do Início: "Cálculo II às 14:20" / "Sala 6019 B · Pav. João Lyra Filho".
 */
export function reminderText(item: AttendedClassesSchedule): ReminderText {
  const name = item.class?.name || item.subject_id;
  const { room, place } = splitLocation(item.class?.uerjLocation);
  const informed = Boolean(place) || room !== 'Sala não informada';
  const body = informed
    ? [room, place].filter(Boolean).join(' · ')
    : item.class?.avaLocation
      ? 'Sala virtual (AVA)'
      : room;
  return { title: `${name} às ${item.startTimeAlias}`, body };
}
