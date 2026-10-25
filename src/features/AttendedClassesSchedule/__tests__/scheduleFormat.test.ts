import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import {
  dateLabel,
  duration,
  findNextClass,
  locationLabel,
  meetingSummary,
  slotRange,
  splitLocation,
  weekDates,
} from '../scheduleFormat';

const item = (
  id: string,
  dayNumber: number,
  periodAlias: string,
  start: [string, number],
  end: [string, number],
  status = 'ACTIVE',
): AttendedClassesSchedule => ({
  class: {
    id,
    name: id,
    class: '1',
    avaLocation: '',
    uerjLocation: '',
    status,
  },
  dayAlias: '',
  dayNumber,
  subject_id: id,
  periodAlias,
  startTimeAlias: start[0],
  endTimeAlias: end[0],
  start_time_in_minutes: start[1],
  end_time_in_minutes: end[1],
});

const schedule = [
  item('COMP', 2, 'M3', ['8:50', 530], ['10:30', 630]),
  item('OTIM', 2, 'T1', ['12:20', 740], ['14:10', 850]),
  item('OTIM', 4, 'T1', ['12:20', 740], ['14:10', 850]),
  item('CG', 3, 'M1', ['7:00', 420], ['8:40', 520], 'CANCELED'),
];

/** Terça, 13/10/2026. */
const at = (h: number, m: number, day = 13) => new Date(2026, 9, day, h, m);

it('finds the class later today with the minutes left', () => {
  const next = findNextClass(schedule, at(11, 58));
  expect(next?.item.subject_id).toBe('OTIM');
  expect(next).toMatchObject({ dayOffset: 0, inMinutes: 22, ongoing: false });
});

it('treats a class in progress as happening now', () => {
  expect(findNextClass(schedule, at(13, 0))).toMatchObject({
    dayOffset: 0,
    ongoing: true,
  });
});

it('skips canceled classes and wraps to the next class day', () => {
  // quarta: só a cancelada; a próxima é a de quinta
  const next = findNextClass(schedule, at(7, 0, 14));
  expect(next?.item.dayNumber).toBe(4);
  expect(next).toMatchObject({ dayOffset: 1, inMinutes: null });
  // terça à noite, depois da última aula da semana: a próxima é quinta
  expect(findNextClass(schedule, at(20, 0))?.item.dayNumber).toBe(4);
  // sexta à noite: volta para a terça seguinte
  expect(findNextClass(schedule, at(20, 0, 16))).toMatchObject({
    dayOffset: 4,
  });
});

it('ignores a class whose time the portal did not give, like the widget', () => {
  // quarta à noite: a linha "??" (−1) de quinta não pode vir antes das 12:20
  const unknown = item('LAB', 4, '??', ['??', -1], ['??', -1]);
  const next = findNextClass([...schedule, unknown], at(20, 0, 14));
  expect(next?.item.subject_id).toBe('OTIM');
  expect(findNextClass([unknown], at(20, 0, 14))).toBeNull();
});

it('finds the same weekday next week when it is the only class day', () => {
  const only = [item('OTIM', 2, 'T1', ['12:20', 740], ['14:10', 850])];
  expect(findNextClass(only, at(15, 0))).toMatchObject({
    dayOffset: 7,
    ongoing: false,
    inMinutes: null,
  });
  expect(findNextClass([], at(15, 0))).toBeNull();
});

it('formats slots, durations, dates and the week', () => {
  expect(slotRange(schedule[1])).toBe('T1–T2');
  expect(duration(22)).toBe('22 min');
  expect(duration(110)).toBe('1h50');
  expect(duration(60)).toBe('1h');
  expect(dateLabel(at(11, 58))).toBe('Terça, 13 de outubro');
  const week = weekDates(at(11, 58));
  expect(week.get(1)?.getDate()).toBe(12);
  expect(week.get(6)?.getDate()).toBe(17);
  // domingo mostra a semana que começa no dia seguinte
  expect(
    weekDates(at(10, 0, 18))
      .get(1)
      ?.getDate(),
  ).toBe(19);
});

it('splits the room from the rest of the place', () => {
  expect(
    splitLocation('Pav. João Lyra Filho · 6º andar · Sala 6019 B'),
  ).toEqual({ room: 'Sala 6019 B', place: 'Pav. João Lyra Filho · 6º andar' });
  expect(splitLocation('PHLC - 6º andar - Sala 6037')).toEqual({
    room: 'Sala 6037',
    place: 'PHLC · 6º andar',
  });
  expect(splitLocation('Sala 6037 F')).toEqual({
    room: 'Sala 6037 F',
    place: '',
  });
  expect(locationLabel('Não Informado')).toBe('Sala não informada');
  expect(splitLocation(undefined).room).toBe('Sala não informada');
});

it('summarises meetings grouped by time', () => {
  expect(meetingSummary(schedule.filter(c => c.subject_id === 'OTIM'))).toEqual(
    ['Ter e Qui · T1–T2 · 12:20–14:10'],
  );
});

it('says when a subject has no time in the grid', () => {
  // estágio ou TCC: o portal não o põe na grade
  expect(meetingSummary([item('EST', 0, '', ['', -1], ['', -1])])).toEqual([
    'Sem horário fixo na grade',
  ]);
  expect(meetingSummary([])).toEqual([]);
});
