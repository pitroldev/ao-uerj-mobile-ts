import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import {
  slotRange,
  splitLocation,
} from '@features/AttendedClassesSchedule/scheduleFormat';
import type { WidgetClassText } from '../domain/nextClassWidget';

/**
 * Texto de uma aula no widget, como no card "Próxima aula" do Início:
 * tempos e sala numa linha ("T3–T4 · Sala 6019 B") e o restante do local
 * na outra.
 */
export function widgetText(item: AttendedClassesSchedule): WidgetClassText {
  const { room, place } = splitLocation(item.class?.uerjLocation);
  const slots = slotRange(item);
  return {
    title: item.class?.name || item.subject_id,
    detail: slots ? `${slots} · ${room}` : room,
    place,
  };
}
