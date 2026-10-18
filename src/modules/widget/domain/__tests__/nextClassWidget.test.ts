import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import { buildWidgetSchedule, WIDGET_VALIDITY } from '../nextClassWidget';

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
  title: item.class.name,
  detail: `${item.periodAlias} · ${item.class.uerjLocation}`,
  place: '',
});

it('keeps each class meeting of the week, in order, with its texts', () => {
  const schedule = buildWidgetSchedule(
    [
      meeting({ dayNumber: 4, dayAlias: 'Quinta-feira' }),
      meeting({
        start_time_in_minutes: 420,
        end_time_in_minutes: 520,
        startTimeAlias: '7:00',
        endTimeAlias: '8:40',
        periodAlias: 'M1',
      }),
    ],
    { fetchedAt: 1000, text },
  );
  expect(schedule).toEqual({
    updatedAt: 1000,
    expiresAt: 1000 + WIDGET_VALIDITY,
    classes: [
      {
        weekday: 2,
        start: 420,
        end: 520,
        startLabel: '7:00',
        endLabel: '8:40',
        title: 'Cálculo II',
        detail: 'M1 · Sala 6019 B',
        place: '',
      },
      expect.objectContaining({ weekday: 4, start: 860, end: 960 }),
    ],
  });
});

it('leaves out canceled classes, unknown times and repeated meetings', () => {
  const schedule = buildWidgetSchedule(
    [
      meeting({}, 'CANCELED'),
      meeting({ start_time_in_minutes: -1 }),
      meeting({ end_time_in_minutes: 800 }),
      meeting({ dayNumber: 0 }),
      meeting(),
      meeting(),
    ],
    { fetchedAt: 0, text },
  );
  expect(schedule.classes).toHaveLength(1);
});
