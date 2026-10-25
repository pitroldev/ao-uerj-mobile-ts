import type { Evaluation } from '../../domain/evaluations';
import {
  countdown,
  dateTimeText,
  dayMonth,
  evaluationTitle,
  reminderBody,
  reminderTitle,
  shortDate,
  whenText,
} from '../evaluationText';

const NOW = new Date(2026, 10, 23, 13, 5);

const exam: Evaluation = {
  id: 'e1',
  subjectId: '342',
  subjectName: 'Física III',
  type: 'P1',
  date: '2026-11-24',
  time: 8 * 60,
  note: 'Capítulos 21 a 24 do Halliday.',
  reminders: ['eve', 'day'],
  earlyTime: 20 * 60,
  dayTime: 7 * 60,
  done: false,
};
const work: Evaluation = {
  ...exam,
  type: 'work',
  date: '2026-11-27',
  time: 23 * 60 + 59,
  note: '',
};

it('names the evaluation and its time', () => {
  expect(evaluationTitle(exam)).toBe('P1 de Física III');
  expect(evaluationTitle(work)).toBe('Entrega do trabalho de Física III');
  expect(evaluationTitle({ ...exam, type: 'other' })).toBe(
    'Avaliação de Física III',
  );
  expect(whenText(exam)).toBe('8:00');
  expect(whenText(work)).toBe('até 23:59');
});

it('counts the days and writes the dates', () => {
  expect(countdown('2026-11-23', NOW)).toBe('Hoje');
  expect(countdown('2026-11-24', NOW)).toBe('Amanhã');
  expect(countdown('2026-11-27', NOW)).toBe('Em 4 dias');
  expect(shortDate('2026-11-24')).toBe('Ter, 24/11');
  expect(dayMonth('2026-12-02')).toBe('02/12');
  expect(dateTimeText(new Date(2026, 10, 23, 20, 0))).toBe('Seg, 23/11, 20:00');
});

it('writes the notification of each reminder', () => {
  expect(reminderTitle(exam, 'eve')).toBe('Amanhã: P1 de Física III');
  expect(reminderTitle(exam, 'day')).toBe('Hoje, 8:00: P1 de Física III');
  expect(reminderTitle(work, 'day')).toBe(
    'Hoje, até 23:59: Entrega do trabalho de Física III',
  );
  expect(reminderTitle(exam, 'h1')).toBe('Em 1 hora: P1 de Física III');
  expect(reminderBody(exam, 'eve', 'Sala 3025 F')).toBe(
    'Terça, 24 de novembro, 8:00 · Sala 3025 F · Capítulos 21 a 24 do Halliday.',
  );
  expect(reminderBody(exam, 'day', 'Sala 3025 F')).toBe(
    'Sala 3025 F · Capítulos 21 a 24 do Halliday.',
  );
  expect(reminderBody(work, 'h2', null)).toBe('até 23:59');
});
