import type {
  GeneratedClassWithSubject,
  Schedule,
} from '@root/modules/planning/domain/models';
import type { SubjectInfo } from '@root/modules/academics/domain/models';

import { buildPlanImage, roomsOf } from '../planImage';

const at = (week_day: number, start: number, end: number): Schedule => ({
  week_day,
  start_time_in_minutes: start,
  end_time_in_minutes: end,
});

const placed = (
  id: string,
  name: string,
  turma: string,
  schedules: Schedule[],
  teachers: string[] = [],
): GeneratedClassWithSubject => ({
  id: turma,
  name,
  type: 'REGULAR',
  subject_id: id,
  teachers,
  vacancies_amount: 10,
  schedules,
  subject: {
    id,
    name,
    type: 'MANDATORY',
    credits: 4,
    total_workload: 60,
    prerequisites: [],
    allow_conflict: false,
  },
});

/** Compiladores: segunda, M3 e M4 em dois encontros; quarta, M3–M4 num só. */
const COMPILERS = placed(
  'IME02-10871',
  'Compiladores',
  '1',
  [at(0, 530, 580), at(0, 580, 630), at(2, 530, 630)],
  ['Marcos Teles', 'Ana Beatriz Coelho'],
);
/** Gráfica: sábado à tarde (o 5 do gerador é o sábado). */
const GRAPHICS = placed('IME02-10880', 'Computação Gráfica', '2', [
  at(5, 860, 960),
]);

const INFO: SubjectInfo[] = [
  {
    id: 'IME02-10871',
    classes: [
      {
        classNumber: 1,
        location: 'Pav. João Lyra Filho · 6º andar · Sala 6001 F',
        vacancies: {} as never,
      },
    ],
  },
  {
    id: 'IME02-10880',
    classes: [{ classNumber: 2, location: '', vacancies: {} as never }],
  },
];

it('draws the planned schedule with its title, credits and the week until Saturday', () => {
  const svg = buildPlanImage([COMPILERS, GRAPHICS], { credits: 8 });
  expect(svg).toMatch(
    /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="1080"/,
  );
  expect(svg).toContain('>Grade planejada</text>');
  // 2 tempos na segunda, 2 na quarta e 2 no sábado
  expect(svg).toContain('2 disciplinas · 8 créditos · 6 tempos por semana');
  expect(svg).toContain('>SÁB</text>');
});

it('joins the times of a class in a row into one block', () => {
  const svg = buildPlanImage([COMPILERS]);
  // segunda e quarta, cada uma num bloco só de 8:50 a 10:30
  expect(svg.match(/>8:50–10:30</g)).toHaveLength(2);
  expect(svg).not.toContain('>8:50–9:40<');
});

it('names the class, its teachers and, when the portal says, the room', () => {
  const svg = buildPlanImage([COMPILERS, GRAPHICS], {
    rooms: roomsOf(INFO),
  });
  expect(svg).toContain('Turma 1 · Marcos Teles, Ana Beatriz Coelho');
  expect(svg).toContain('Sala 6001 F · IME02-10871');
  // sem sala informada, fica só o código
  expect(svg).toContain('>IME02-10880</text>');
  expect(svg).toContain('Turma 2');
});

it('finds the room of each class by subject and class number', () => {
  expect(roomsOf(INFO)).toEqual(new Map([['IME02-10871#1', 'Sala 6001 F']]));
});
