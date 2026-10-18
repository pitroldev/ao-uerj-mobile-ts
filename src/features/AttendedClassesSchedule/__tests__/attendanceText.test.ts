import { attendanceSummary } from '@root/modules/attendance/domain/attendance';
import { attendanceTone, remainingText, usedText } from '../attendanceText';

it('counts used slots against the limit', () => {
  expect(usedText(attendanceSummary(8, 15))).toBe('8 de 15 tempos');
  expect(usedText(attendanceSummary(1, null))).toBe('1 tempo');
});

it('says how much room is left, in slots and whole classes', () => {
  expect(remainingText(attendanceSummary(8, 15), 2)).toBe(
    'Ainda pode faltar 7 tempos (3 aulas)',
  );
  expect(remainingText(attendanceSummary(13, 15), 2)).toBe(
    'Ainda pode faltar 2 tempos (1 aula)',
  );
  expect(remainingText(attendanceSummary(14, 15), 2)).toBe(
    'Ainda pode faltar 1 tempo',
  );
  expect(remainingText(attendanceSummary(15, 15), 2)).toBe(
    'No limite: a próxima falta reprova',
  );
  expect(remainingText(attendanceSummary(17, 15), 2)).toBe(
    'Passou do limite em 2 tempos',
  );
});

it('covers no absences and an unknown limit', () => {
  expect(remainingText(attendanceSummary(0, 15), 2)).toBe(
    'Nenhuma falta marcada',
  );
  expect(remainingText(attendanceSummary(3, null), 2)).toBe(
    'Sem a carga horária, não há como saber o limite',
  );
});

it('maps the level to a tone', () => {
  expect(attendanceTone(attendanceSummary(0, 15))).toBe('neutral');
  expect(attendanceTone(attendanceSummary(2, 15))).toBe('good');
  expect(attendanceTone(attendanceSummary(8, 15))).toBe('warn');
  expect(attendanceTone(attendanceSummary(16, 15))).toBe('bad');
  expect(attendanceTone(attendanceSummary(3, null))).toBe('neutral');
});
