import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import { widgetText } from '../widgetText';

const meeting = (uerjLocation: string): AttendedClassesSchedule => ({
  class: {
    id: 'IME02-00001',
    name: 'Cálculo II',
    class: '3',
    avaLocation: '',
    uerjLocation,
    status: 'ACTIVE',
  },
  dayAlias: 'Terça-feira',
  dayNumber: 2,
  subject_id: 'IME02-00001',
  periodAlias: 'T3',
  startTimeAlias: '14:20',
  endTimeAlias: '16:00',
  start_time_in_minutes: 860,
  end_time_in_minutes: 960,
});

it('puts the time slots and the room together, and the rest of the place apart', () => {
  expect(
    widgetText(meeting('Pav. João Lyra Filho · 6º andar · Sala 6019 B')),
  ).toEqual({
    title: 'Cálculo II',
    detail: 'T3–T4 · Sala 6019 B',
    place: 'Pav. João Lyra Filho · 6º andar',
  });
});

it('says when the portal has no room', () => {
  expect(widgetText(meeting(''))).toMatchObject({
    detail: 'T3–T4 · Sala não informada',
    place: '',
  });
});
