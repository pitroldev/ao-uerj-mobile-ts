import assert from 'node:assert/strict';
import { test } from 'node:test';

import type {
  GenerateSchedulesRequest,
  GeneratorClass,
  GeneratorSubject,
  SchedulePriority,
  ScheduleInterval,
} from '../src/adapters/inbound/http/contract.ts';
import { generationSchema } from '../src/adapters/inbound/http/schedules/request.ts';
import { toGenerationResponse } from '../src/adapters/inbound/http/schedules/response.ts';
import { parse } from '../src/adapters/inbound/http/validation.ts';
import { createInlineSolver } from '../src/adapters/outbound/scheduleSolver/inlineSolver.ts';
import { createScheduleGenerator } from '../src/modules/schedules/application.ts';
import {
  respectsLunchBreak,
  type PlacedClass,
} from '../src/modules/schedules/domain/compatibility.ts';
import { createLeaderboard } from '../src/modules/schedules/domain/leaderboard.ts';
import type {
  Interval,
  Subject,
} from '../src/modules/schedules/domain/model.ts';
import {
  CRITERIA,
  createRanking,
  priorityOrder,
} from '../src/modules/schedules/domain/ranking.ts';
import {
  generateSchedules,
  type SearchOptions,
} from '../src/modules/schedules/domain/search.ts';
import type { ScheduleSolver } from '../src/modules/schedules/ports.ts';
import { legacyGaps, legacyGenerate } from './legacyGenerator.ts';

/** Do JSON do pedido ao JSON da resposta, pelo mesmo caminho do HTTP. */
function generate(body: unknown, options?: SearchOptions) {
  const { wire, request } = parse(generationSchema, body);
  const result = generateSchedules(request, options);
  return {
    result,
    data: JSON.parse(JSON.stringify(toGenerationResponse(result, wire).data)),
  };
}

/** O tempo livre de verdade: junta as aulas que se sobrepõem antes de medir. */
const realGaps = (schedules: ScheduleInterval[]) => {
  const sorted = [...schedules].sort(
    (a, b) =>
      a.start_time_in_minutes - b.start_time_in_minutes ||
      a.end_time_in_minutes - b.end_time_in_minutes,
  );
  let end = sorted[0]?.end_time_in_minutes ?? 0;
  let gaps = 0;
  for (const s of sorted) {
    if (s.start_time_in_minutes > end) gaps += s.start_time_in_minutes - end;
    end = Math.max(end, s.end_time_in_minutes);
  }
  return gaps;
};

/**
 * Park-Miller: os mesmos casos em toda execução. O produto cabe com folga
 * nos 53 bits do número, então a conta é exata. Com sementes pequenas, os
 * primeiros sorteios saem parecidos: os dez primeiros vão fora.
 */
function seeded(seed: number) {
  const MODULUS = 2147483647;
  let state = seed % MODULUS || 1;
  const next = () => {
    state = (state * 48271) % MODULUS;
    return (state - 1) / (MODULUS - 1);
  };
  for (let i = 0; i < 10; i++) next();
  return next;
}

const APP_PRIORITIES: SchedulePriority[] = [
  'MIN_GAPS',
  'LIVES_FAR_AWAY',
  'CRITICAL_FIRST',
  'MAX_DAY_WORKLOAD',
  'MIN_DAY_WORKLOAD',
  'MAX_WORKLOAD',
  'MIN_WORKLOAD',
  'MANDATORY_CLASSES',
  'MOST_SUBJECTS_POSSIBLE',
  'MAX_CREDITS',
];

/**
 * Um pedido sintético: disciplinas com uma a três turmas, às vezes com o
 * mesmo horário, choques, choque permitido, horários ocupados, turma de
 * disciplina desconhecida e prioridades repetidas.
 */
function randomRequest(seed: number): GenerateSchedulesRequest {
  const random = seeded(seed);
  const int = (low: number, high: number) =>
    low + Math.floor(random() * (high - low + 1));
  const pick = <T>(list: readonly T[]): T => list[int(0, list.length - 1)];
  const interval = (): ScheduleInterval => {
    const start = int(14, 40) * 25;
    return {
      week_day: int(0, 5),
      start_time_in_minutes: start,
      end_time_in_minutes: start + int(2, 6) * 25,
    };
  };

  const ranked = random() < 0.3;
  const subjects: GeneratorSubject[] = Array.from(
    { length: int(2, 8) },
    (_, index) => {
      const credits = int(0, 6);
      return {
        id: `IME0${index}-1000${index}`,
        name: `Sintética ${index}`,
        type: pick(['MANDATORY', 'RESTRICTED', 'UNIVERSAL']),
        credits,
        total_workload: credits * 15,
        prerequisites: [],
        allow_conflict: random() < 0.15,
        ...(ranked ? { criticality: int(0, 3), blocks: int(0, 4) } : {}),
      };
    },
  );

  const classes: GeneratorClass[] = [];
  for (const subject of subjects) {
    let previous: ScheduleInterval[] | undefined;
    for (let count = int(1, 3); count > 0; count--) {
      const schedules =
        previous && random() < 0.3
          ? previous.map(s => ({ ...s }))
          : Array.from({ length: int(1, 3) }, interval);
      previous = schedules;
      classes.push({
        id: String(classes.length + 1),
        name: subject.name,
        type: pick(['PREFERRED', 'REGULAR']),
        teachers: [],
        vacancies_amount: int(0, 40),
        subject_id: subject.id,
        schedules,
      });
    }
  }
  if (random() < 0.2)
    classes.push({ ...classes[0], id: '99', subject_id: 'XXX00-00000' });
  for (let i = classes.length - 1; i > 0; i--) {
    const j = int(0, i);
    [classes[i], classes[j]] = [classes[j], classes[i]];
  }

  const minimum = int(1, 3);
  return {
    preferences: {
      min_subject_amount: minimum,
      max_subject_amount: random() < 0.1 ? int(1, 6) : int(minimum, 6),
      priority: Array.from({ length: int(0, 3) }, () => pick(APP_PRIORITIES)),
      busy_schedules: Array.from({ length: int(0, 2) }, interval),
    },
    classes,
    subjects,
  };
}

test('the search returns exactly what the production generator returns', () => {
  let compared = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const body = randomRequest(seed);
    const expected = JSON.parse(
      JSON.stringify(legacyGenerate(body, { gaps: realGaps })),
    );
    assert.deepEqual(generate(body).data, expected, `seed ${seed}`);
    if (expected.length) compared += 1;
  }
  // a maioria dos casos tem grade para comparar
  assert.ok(compared > 300, `only ${compared} cases had results`);
});

test('the idle time joins overlapping classes (the old math counted a gap inside a class)', () => {
  const day = (start: number, end: number): ScheduleInterval => ({
    week_day: 0,
    start_time_in_minutes: start,
    end_time_in_minutes: end,
  });
  const long = [day(100, 400)];
  const inside = [day(150, 200), day(250, 300)];
  assert.equal(legacyGaps([...long, ...inside]), 50);

  const subject = (id: string, allow = false): GeneratorSubject => ({
    id,
    name: id,
    type: 'MANDATORY',
    credits: 4,
    total_workload: 60,
    prerequisites: [],
    allow_conflict: allow,
  });
  const option = (
    id: string,
    schedules: ScheduleInterval[],
  ): GeneratorClass => ({
    id: '1',
    name: id,
    type: 'REGULAR',
    teachers: [],
    vacancies_amount: 10,
    subject_id: id,
    schedules,
  });
  const { data } = generate({
    preferences: { min_subject_amount: 2, max_subject_amount: 2, priority: [] },
    classes: [option('A', long), option('B', inside)],
    subjects: [subject('A'), subject('B', true)],
  });
  assert.equal(data.length, 1);
  assert.equal(data[0].total_gaps_in_minutes, 0);
});

/** Disciplinas sem choque nenhum: o pior caso da busca. */
function openRequest(subjects: number, classesPerSubject = 1) {
  const body: GenerateSchedulesRequest = {
    preferences: {
      min_subject_amount: 1,
      max_subject_amount: 12,
      priority: ['MAX_CREDITS'],
    },
    subjects: [],
    classes: [],
  };
  for (let i = 0; i < subjects; i++) {
    const id = `IME${String(i).padStart(2, '0')}-00000`;
    body.subjects.push({
      id,
      name: id,
      type: 'MANDATORY',
      credits: 1 + (i % 4),
      total_workload: 60,
      prerequisites: [],
      allow_conflict: false,
    });
    for (let k = 0; k < classesPerSubject; k++)
      body.classes.push({
        id: String(k + 1),
        name: id,
        type: 'REGULAR',
        teachers: [],
        vacancies_amount: 10,
        subject_id: id,
        schedules: [
          {
            week_day: (i + k) % 6,
            start_time_in_minutes: 420 + 50 * Math.floor(i / 6) + 600 * k,
            end_time_in_minutes: 470 + 50 * Math.floor(i / 6) + 600 * k,
          },
        ],
      });
  }
  return body;
}

test('branches that cannot reach the fifth best are cut instead of enumerated', () => {
  // 12 disciplinas com duas turmas cada: o servidor antigo guardava 3^12
  // (531441) combinações antes de ordenar
  const { result, data } = generate(openRequest(12, 2));
  assert.equal(result.exhaustive, true);
  assert.ok(result.visited < 20000, `visited ${result.visited}`);
  assert.equal(data.length, 5);
  assert.ok(
    data.every((s: { schedule: unknown[] }) => s.schedule.length === 12),
  );
});

test('a search that runs out of time keeps the best it found', () => {
  // 30 disciplinas livres e até 12: dezenas de milhões de grades com 12
  let asked = 0;
  const { result, data } = generate(openRequest(30), {
    shouldStop: () => ++asked > 2,
  });
  assert.equal(result.exhaustive, false);
  assert.equal(data.length, 5);
  assert.ok(
    data.every((s: { schedule: unknown[] }) => s.schedule.length === 12),
  );
});

test('fewer than one subject means one, and a maximum below the minimum finds nothing', () => {
  const body = openRequest(3);
  body.preferences.max_subject_amount = 1;
  body.preferences.min_subject_amount = 0;
  const { data } = generate(body);
  assert.deepEqual(
    data.map((s: { schedule: unknown[] }) => s.schedule.length),
    [1, 1, 1],
  );

  body.preferences.min_subject_amount = 2;
  assert.deepEqual(generate(body).data, []);
});

test('more subjects always rank first, and a repeated priority changes nothing', () => {
  assert.deepEqual(priorityOrder([]), ['MOST_SUBJECTS_POSSIBLE']);
  assert.deepEqual(
    priorityOrder(['MIN_GAPS', 'MOST_SUBJECTS_POSSIBLE', 'MIN_GAPS']),
    ['MOST_SUBJECTS_POSSIBLE', 'MIN_GAPS'],
  );
});

test('each priority is a strategy where lower is better, and only some need the day measures', () => {
  const totals = {
    count: 3,
    credits: 12,
    workload: 180,
    mandatory: 2,
    criticality: 1,
    blocks: 4,
    weekDays: 2,
    gapMinutes: 50,
    busiestDay: 200,
  };
  assert.equal(CRITERIA.MAX_CREDITS.score(totals), -12);
  assert.equal(CRITERIA.MIN_GAPS.score(totals), 50);
  assert.equal(CRITERIA.LIVES_FAR_AWAY.score(totals), 2);

  const light = createRanking(['MAX_CREDITS', 'MANDATORY_CLASSES']);
  assert.equal(light.byDay, false);
  assert.deepEqual(light.score(totals), [-3, -12, -2]);
  assert.equal(createRanking(['MAX_CREDITS', 'MIN_GAPS']).byDay, true);
});

test('the leaderboard keeps the best few, the first of equals, and tells the subjects needed to get in', () => {
  const board = createLeaderboard<string>(2);
  const standing = (count: number, seq: number, identity: string) => ({
    score: [-count],
    seq,
    count,
    identity,
    value: identity,
  });
  assert.equal(board.floor(), 0);
  board.add(standing(2, 1, 'A'));
  board.add(standing(3, 2, 'B'));
  // a mesma grade de novo, achada depois: fica a primeira
  board.add(standing(2, 3, 'A'));
  assert.deepEqual(
    board.standings().map(entry => entry.value),
    ['B', 'A'],
  );
  assert.equal(board.floor(), 2);
  // empate com a última: a encontrada antes fica
  assert.equal(board.admits({ score: [-2], seq: 4 }), false);
  assert.equal(board.admits({ score: [-3], seq: 5 }), true);
  board.add(standing(3, 5, 'C'));
  assert.deepEqual(
    board.standings().map(entry => entry.value),
    ['B', 'C'],
  );
  assert.equal(board.floor(), 3);
});

test('the generator answers a request with no way out without the solver', async () => {
  let calls = 0;
  const solver: ScheduleSolver = {
    async solve() {
      calls += 1;
      return { schedules: [], exhaustive: true, visited: 0 };
    },
    load: () => ({ running: 0, queued: 0 }),
  };
  const generator = createScheduleGenerator(solver);
  const { request } = parse(generationSchema, openRequest(2));

  await generator.generate({ ...request, classes: [] });
  await generator.generate({ ...request, minSubjects: 3, maxSubjects: 2 });
  assert.equal(calls, 0);
  await generator.generate(request);
  assert.equal(calls, 1);

  const gone = new AbortController();
  gone.abort();
  await assert.rejects(generator.generate(request, { signal: gone.signal }), {
    name: 'AbortError',
  });
});

test('the inline solver honors its time budget', async () => {
  const solver = createInlineSolver({ budgetMs: 50 });
  const { request } = parse(generationSchema, openRequest(30));
  const started = performance.now();
  const result = await solver.solve(request);
  assert.equal(result.exhaustive, false);
  assert.equal(result.schedules.length, 5);
  assert.ok(performance.now() - started < 2000);
});

/* --------------------------------------------------- Horário de almoço */

const anySubject: Subject = {
  id: 'X',
  credits: 0,
  workload: 0,
  mandatory: false,
  allowsConflict: false,
  criticality: 0,
  blocks: 0,
};
const span = (day: number, start: number, end: number): Interval => ({
  day,
  start,
  end,
});
const classAt = (
  intervals: Interval[],
  allowsConflict = false,
): PlacedClass => ({
  subject: allowsConflict
    ? { ...anySubject, allowsConflict: true }
    : anySubject,
  intervals,
});

test('the lunch break leaves a continuous free slot in the window on every day with class', () => {
  const lunch = { start: 690, end: 850, minutes: 50 };
  // 690–740 e 800–850 deixam 740–800 (60) livre
  assert.equal(
    respectsLunchBreak(
      [classAt([span(0, 690, 740)]), classAt([span(0, 800, 850)])],
      lunch,
    ),
    true,
  );
  // 690–740, 740–800 e 800–850 não deixam nada
  assert.equal(
    respectsLunchBreak(
      [
        classAt([span(0, 690, 740)]),
        classAt([span(0, 740, 800)]),
        classAt([span(0, 800, 850)]),
      ],
      lunch,
    ),
    false,
  );
  // só aula de manhã até 740 deixa 740–850 livre
  assert.equal(respectsLunchBreak([classAt([span(0, 600, 740)])], lunch), true);
  // um dia só à noite (fora da janela) e a grade vazia passam
  assert.equal(
    respectsLunchBreak([classAt([span(0, 900, 1000)])], lunch),
    true,
  );
  assert.equal(respectsLunchBreak([], lunch), true);
});

test('a long lunch break needs two free periods in a row, and overlapping classes both count', () => {
  const wide = { start: 690, end: 850, minutes: 100 };
  // janela inteira livre (160) dá os 100 seguidos
  assert.equal(respectsLunchBreak([], wide), true);
  // uma aula de 50 no meio parte a janela em 50 e 60: não há 100 seguidos
  assert.equal(respectsLunchBreak([classAt([span(0, 740, 790)])], wide), false);
  // duas aulas sobrepostas (uma com choque permitido) cobrem a janela
  const lunch = { start: 690, end: 850, minutes: 50 };
  assert.equal(
    respectsLunchBreak(
      [classAt([span(0, 690, 800)]), classAt([span(0, 750, 850)], true)],
      lunch,
    ),
    false,
  );
});

const WINDOW = {
  start_time_in_minutes: 690,
  end_time_in_minutes: 850,
  minimum_minutes: 50,
};

/** Um pedido com uma turma por `[disciplina, dia, início, fim]`. */
function lunchRequest(
  specs: Array<[string, number, number, number]>,
): GenerateSchedulesRequest {
  const ids = [...new Set(specs.map(([id]) => id))];
  return {
    preferences: {
      min_subject_amount: 1,
      max_subject_amount: ids.length,
      priority: ['MAX_CREDITS'],
    },
    subjects: ids.map(id => ({
      id,
      name: id,
      type: 'MANDATORY',
      credits: 4,
      total_workload: 60,
      prerequisites: [],
      allow_conflict: false,
    })),
    classes: specs.map(([id, day, start, end], index) => ({
      id: String(index + 1),
      name: id,
      type: 'REGULAR',
      teachers: [],
      vacancies_amount: 10,
      subject_id: id,
      schedules: [
        {
          week_day: day,
          start_time_in_minutes: start,
          end_time_in_minutes: end,
        },
      ],
    })),
  };
}

test('the lunch break drops a subject when a day fills the window, and leaves the rest untouched', () => {
  const body = lunchRequest([
    ['A', 0, 690, 740],
    ['B', 0, 740, 800],
    ['C', 0, 800, 850],
  ]);
  // sem almoço, as três seguidas são a melhor grade (três disciplinas)
  assert.equal(generate(body).data[0].schedule.length, 3);
  // com o almoço, a janela não cabe as três: no máximo duas
  body.preferences.lunch_break = WINDOW;
  const withLunch = generate(body);
  assert.equal(withLunch.data[0].schedule.length, 2);
  assert.ok(
    withLunch.data.every(
      (s: { schedule: unknown[] }) => s.schedule.length <= 2,
    ),
  );
});

test('with the lunch break, a minimum no valid schedule can reach is empty', () => {
  const body = lunchRequest([
    ['A', 0, 690, 740],
    ['B', 0, 740, 800],
    ['C', 0, 800, 850],
  ]);
  body.preferences.min_subject_amount = 3;
  body.preferences.max_subject_amount = 3;
  // sem almoço, as três seguidas formam a única grade
  assert.equal(generate(body).data.length, 1);
  body.preferences.lunch_break = WINDOW;
  assert.deepEqual(generate(body).data, []);
});

test('a class that fills the whole lunch window never enters a schedule', () => {
  // D cobre a janela inteira no dia 0; E é livre no dia 1
  const body = lunchRequest([
    ['D', 0, 690, 850],
    ['E', 1, 100, 200],
  ]);
  // sem almoço, D e E cabem juntas
  assert.ok(
    generate(body).data.some(
      (s: { schedule: unknown[] }) => s.schedule.length === 2,
    ),
  );
  body.preferences.lunch_break = WINDOW;
  const limited = generate(body);
  // D sai do catálogo (cobre a janela sozinha): sobra só E
  assert.ok(
    limited.data.every((s: { schedule: { subject_id: string }[] }) =>
      s.schedule.every(c => c.subject_id !== 'D'),
    ),
  );
  assert.deepEqual(
    limited.data.map((s: { schedule: unknown[] }) => s.schedule.length),
    [1],
  );
});
