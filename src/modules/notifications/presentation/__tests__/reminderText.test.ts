import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import { reminderText } from '../reminderText';

const meeting = (
  uerjLocation: string,
  avaLocation = '',
): AttendedClassesSchedule => ({
  class: {
    id: 'IME02-00001',
    name: 'Cálculo II',
    class: '3',
    avaLocation,
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

it.each([
  [
    meeting('Pav. João Lyra Filho · 6º andar · Sala 6019 B'),
    'Sala 6019 B · Pav. João Lyra Filho · 6º andar',
  ],
  [meeting('6019 B'), '6019 B'],
  [meeting('', 'ava.uerj.br/123'), 'Sala virtual (AVA)'],
  [meeting('Não informado'), 'Sala não informada'],
])('puts the room first (%#)', (item, body) => {
  expect(reminderText(item)).toEqual({ title: 'Cálculo II às 14:20', body });
});
