import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import { courseSubjects, evaluationRoom } from '../scheduleLookup';

const meeting = (
  dayNumber: number,
  start: number,
  end: number,
  room: string,
): AttendedClassesSchedule => ({
  class: {
    id: 'FIS01-00342',
    name: 'Física III',
    class: '1',
    avaLocation: '',
    uerjLocation: `Pav. João Lyra Filho · ${room}`,
    status: 'ACTIVE',
  },
  dayAlias: '',
  dayNumber,
  subject_id: 'FIS01-00342',
  periodAlias: 'M1',
  startTimeAlias: '',
  endTimeAlias: '',
  start_time_in_minutes: start,
  end_time_in_minutes: end,
});

// segundas: 7:00 no laboratório e 14:20 na sala
const SCHEDULE = [
  meeting(1, 420, 520, 'Lab. 3047 F'),
  meeting(1, 860, 960, 'Sala 3025 F'),
];

it('takes the room of the class that holds the evaluation time', () => {
  const exam = { subjectId: '342', type: 'P2' as const, date: '2026-11-23' };
  expect(evaluationRoom(SCHEDULE, { ...exam, time: 860 })).toBe('Sala 3025 F');
  expect(evaluationRoom(SCHEDULE, { ...exam, time: 420 })).toBe('Lab. 3047 F');
  // fora das aulas, a primeira do dia; trabalho é prazo, sem sala
  expect(evaluationRoom(SCHEDULE, { ...exam, time: 1200 })).toBe('Lab. 3047 F');
  expect(
    evaluationRoom(SCHEDULE, { ...exam, type: 'work', time: 860 }),
  ).toBeNull();
  expect(
    evaluationRoom(SCHEDULE, { ...exam, date: '2026-11-24', time: 860 }),
  ).toBeNull();
});

it('lists the subjects of the schedule and, without a time, of the grades', () => {
  expect(
    courseSubjects(SCHEDULE, [
      { id: 'FIS01-00342', name: 'Física III', class: '1', grades: {} },
      { id: 'IME02-10905', name: 'Ética', class: '3', grades: {} },
    ]),
  ).toEqual([
    { id: '342', name: 'Física III' },
    { id: '10905', name: 'Ética' },
  ]);
});
