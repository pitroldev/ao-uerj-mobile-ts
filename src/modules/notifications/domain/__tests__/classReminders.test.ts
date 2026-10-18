import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import { buildReminderPlan, REMINDER_VALIDITY } from '../classReminders';

const meeting = (
  overrides: Partial<AttendedClassesSchedule> = {},
  status = 'ACTIVE',
): AttendedClassesSchedule => ({
  class: {
    id: 'IME02-00001',
    name: 'Cálculo II',
    class: '3',
    avaLocation: '',
    uerjLocation: 'Sala 6019 B',
    status,
  },
  dayAlias: 'Terça-feira',
  dayNumber: 2,
  subject_id: 'IME02-00001',
  periodAlias: 'T3',
  startTimeAlias: '14:20',
  endTimeAlias: '16:00',
  start_time_in_minutes: 860,
  end_time_in_minutes: 960,
  ...overrides,
});

const text = (item: AttendedClassesSchedule) => ({
  title: `${item.class.name} às ${item.startTimeAlias}`,
  body: item.class.uerjLocation,
});

it('plans one weekly reminder per class meeting, before it starts', () => {
  const plan = buildReminderPlan(
    [
      meeting(),
      meeting({ dayNumber: 4, dayAlias: 'Quinta-feira' }),
      meeting({ start_time_in_minutes: 420, startTimeAlias: '7:00' }),
    ],
    { leadMinutes: 15, fetchedAt: 1000, text },
  );
  expect(plan).toEqual({
    expiresAt: 1000 + REMINDER_VALIDITY,
    leadMinutes: 15,
    reminders: [
      {
        id: 'IME02-00001#3@2:860',
        weekday: 2,
        minutes: 845,
        title: 'Cálculo II às 14:20',
        body: 'Sala 6019 B',
      },
      expect.objectContaining({ id: 'IME02-00001#3@4:860', weekday: 4 }),
      expect.objectContaining({ id: 'IME02-00001#3@2:420', minutes: 405 }),
    ],
  });
});

it('leaves out canceled classes, unknown times and repeated meetings', () => {
  const plan = buildReminderPlan(
    [
      meeting({}, 'CANCELED'),
      meeting({ start_time_in_minutes: -1 }),
      meeting({ dayNumber: 0 }),
      meeting(),
      meeting(),
    ],
    { leadMinutes: 10, fetchedAt: 0, text },
  );
  expect(plan.reminders).toHaveLength(1);
  expect(plan.reminders[0].minutes).toBe(850);
});

it('moves the reminder of a class right after midnight to the night before', () => {
  const plan = buildReminderPlan(
    [
      meeting({ dayNumber: 1, start_time_in_minutes: 10 }),
      meeting({ dayNumber: 3, start_time_in_minutes: 5 }),
    ],
    { leadMinutes: 15, fetchedAt: 0, text },
  );
  expect(plan.reminders).toEqual([
    expect.objectContaining({ weekday: 7, minutes: 24 * 60 - 5 }),
    expect.objectContaining({ weekday: 2, minutes: 24 * 60 - 10 }),
  ]);
});
