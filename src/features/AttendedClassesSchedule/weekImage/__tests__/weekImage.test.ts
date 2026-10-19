import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import { LIGHT } from '@root/themes';
import { buildWeekImage, SUBJECT_PALETTE } from '../weekImage';

/** Tempos da UERJ usados aqui: [início, fim] em minutos e os rótulos. */
const SLOTS: Record<string, [number, number, string, string]> = {
  M1: [420, 470, '7:00', '7:50'],
  M2: [470, 520, '7:50', '8:40'],
  M3: [530, 580, '8:50', '9:40'],
  M4: [580, 630, '9:40', '10:30'],
  N1: [1080, 1130, '18:00', '18:50'],
  N2: [1130, 1180, '18:50', '19:40'],
};

const lesson = (
  day: number,
  from: string,
  to: string,
  fields: Partial<AttendedClassesSchedule['class']> = {},
): AttendedClassesSchedule => ({
  class: {
    id: 'ABC01-12345',
    name: 'Álgebra & Cálculo',
    class: '3',
    avaLocation: '',
    uerjLocation: 'Pav. João Lyra Filho · 6º andar · Sala 6001 F',
    status: '',
    ...fields,
  },
  dayAlias: '',
  dayNumber: day,
  subject_id: fields.id ?? 'ABC01-12345',
  periodAlias: from,
  startTimeAlias: SLOTS[from][2],
  endTimeAlias: SLOTS[to][3],
  start_time_in_minutes: SLOTS[from][0],
  end_time_in_minutes: SLOTS[to][1],
});

const PHYSICS = {
  id: 'FIS01-20010',
  name: 'Física Teórica I',
  class: '1',
  uerjLocation: 'Não informado',
};

it('draws the week as a grid, with the subject, time and room in each class', () => {
  const svg = buildWeekImage(
    [
      lesson(1, 'M1', 'M2'),
      lesson(3, 'M1', 'M2'),
      lesson(2, 'M3', 'M4', PHYSICS),
    ],
    { period: '2026.1' },
  );
  expect(svg).toMatch(
    /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="1080"/,
  );
  expect(svg).toContain('Minha grade');
  expect(svg).toContain('2026.1 · 2 disciplinas · 6 tempos por semana');
  ['SEG', 'TER', 'QUA', 'QUI', 'SEX'].forEach(day =>
    expect(svg).toContain(`>${day}<`),
  );
  expect(svg).not.toContain('>SÁB<');
  expect(svg).toContain('7:00–8:40');
  // a sala sem o resto do endereço; a que o portal não informa fica de fora
  expect(svg).toContain('>Sala 6001 F<');
  expect(svg).not.toContain('Sala não informada');
  // a legenda leva o nome inteiro, com o texto escapado
  expect(svg).toContain('Álgebra &amp; Cálculo');
  expect(svg).toContain('>Turma 3<');
  expect(svg).toContain('>Sala 6001 F · ABC01-12345<');
  expect(svg).toContain('>Turma 1<');
  expect(svg).toContain('>FIS01-20010<');
});

it('names the teachers of each subject next to the class number', () => {
  const svg = buildWeekImage(
    [lesson(1, 'M1', 'M2'), lesson(2, 'M3', 'M4', PHYSICS)],
    {
      teachers: new Map([
        ['12345', ['Ana Souza', 'João Lima']],
        ['20010', ['Lia Prado']],
      ]),
    },
  );
  expect(svg).toContain('>Turma 3 · Ana Souza, João Lima<');
  expect(svg).toContain('>Turma 1 · Lia Prado<');
});

it('gives each subject one color on every day, in the order of the week', () => {
  const svg = buildWeekImage([
    lesson(1, 'M1', 'M2'),
    lesson(2, 'M3', 'M4', PHYSICS),
    lesson(3, 'M1', 'M2'),
  ]);
  const [first, second] = SUBJECT_PALETTE;
  expect(svg.split(`fill="${first.tint}"`)).toHaveLength(3);
  expect(svg.split(`fill="${second.tint}"`)).toHaveLength(2);
});

it('adds Saturday only when there is a class on it', () => {
  expect(buildWeekImage([lesson(6, 'M1', 'M2')])).toContain('>SÁB<');
});

it('leaves out canceled classes and classes without a known time', () => {
  const svg = buildWeekImage([
    lesson(1, 'M1', 'M2'),
    lesson(2, 'M1', 'M2', { ...PHYSICS, status: 'CANCELED' }),
    {
      ...lesson(4, 'M1', 'M2', { id: 'XYZ01-00001', name: 'Sem horário' }),
      start_time_in_minutes: -1,
    },
  ]);
  expect(svg).not.toContain('Física Teórica I');
  expect(svg).not.toContain('Sem horário');
  expect(svg).toContain('1 disciplina · 2 tempos por semana');
});

it('collapses a long empty stretch shared by every day', () => {
  const svg = buildWeekImage([
    lesson(1, 'M1', 'M2'),
    lesson(2, 'N1', 'N2', PHYSICS),
  ]);
  // de manhã até as 9h, à noite das 18h às 20h: a tarde some
  expect(svg).toContain('>9h<');
  expect(svg).toContain('>18h<');
  expect(svg).not.toContain('>13h<');
});

it('says when there is no class to draw', () => {
  const svg = buildWeekImage([], { period: '2026.1' });
  expect(svg).toContain('Sem aulas com horário nesta semana.');
  expect(svg).toContain('Feito com o app AO UERJ');
});

it('uses the light palette, whatever the app theme', () => {
  const svg = buildWeekImage([lesson(1, 'M1', 'M2')]);
  expect(svg).toContain(LIGHT.colors.ink);
  expect(svg).toContain('fill="#FFFFFF"');
});
