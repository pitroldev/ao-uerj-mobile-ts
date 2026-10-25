import type { Evaluation } from '../evaluations';
import {
  buildEvaluationReminderPlan,
  MAX_EVALUATION_REMINDERS,
} from '../reminders';

/** Segunda, 23/11/2026, 13:05. */
const NOW = new Date(2026, 10, 23, 13, 5);

const evaluation = (patch: Partial<Evaluation> = {}): Evaluation => ({
  id: 'e1',
  subjectId: '342',
  subjectName: 'Física III',
  type: 'P1',
  date: '2026-11-24',
  time: 8 * 60,
  note: '',
  reminders: ['eve', 'day'],
  earlyTime: 20 * 60,
  dayTime: 7 * 60,
  done: false,
  ...patch,
});

const text = (item: Evaluation, key: string) => ({
  title: `${key}: ${item.type}`,
  body: item.subjectName,
});

it('plans the coming reminders, the nearest first, with the start as the limit', () => {
  const plan = buildEvaluationReminderPlan(
    [
      evaluation({ id: 'work', type: 'work', date: '2026-11-27', time: 1439 }),
      evaluation(),
    ],
    { now: NOW, text },
  );
  const eve = new Date(2026, 10, 23, 20, 0).getTime();
  expect(plan.reminders[0]).toEqual({
    id: `e1:eve@${eve}`,
    evaluationId: 'e1',
    at: eve,
    until: new Date(2026, 10, 24, 8, 0).getTime(),
    // "Amanhã" vale até o fim do dia do aviso
    latest: new Date(2026, 10, 23, 23, 59).getTime(),
    local: {
      at: '2026-11-23T20:00',
      until: '2026-11-24T08:00',
      latest: '2026-11-23T23:59',
    },
    title: 'eve: P1',
    body: 'Física III',
    completable: false,
  });
  expect(plan.reminders.map(item => item.id.split('@')[0])).toEqual([
    'e1:eve',
    'e1:day',
    'work:eve',
    'work:day',
  ]);
  // trabalhos têm "Já fiz"; provas, não
  expect(plan.reminders[2].completable).toBe(true);
});

it('leaves out the done evaluations and the reminders that passed', () => {
  const plan = buildEvaluationReminderPlan(
    [
      evaluation({ id: 'done', done: true }),
      evaluation({ id: 'today', date: '2026-11-23', time: 14 * 60 + 20 }),
    ],
    { now: NOW, text },
  );
  expect(plan.reminders).toEqual([]);
});

it('changes the id when the time changes, so the phone shows it again', () => {
  const before = buildEvaluationReminderPlan([evaluation()], {
    now: NOW,
    text,
  });
  const after = buildEvaluationReminderPlan(
    [evaluation({ earlyTime: 19 * 60 })],
    {
      now: NOW,
      text,
    },
  );
  expect(after.reminders[0].id).not.toBe(before.reminders[0].id);
});

it('keeps at most the nearest reminders', () => {
  const many = Array.from({ length: 20 }, (_, i) =>
    evaluation({
      id: `e${i}`,
      date: `2026-12-${String(i + 1).padStart(2, '0')}`,
      reminders: ['week', 'three', 'eve', 'day', 'h2', 'h1', 'm30'],
    }),
  );
  const plan = buildEvaluationReminderPlan(many, { now: NOW, text });
  expect(plan.reminders).toHaveLength(MAX_EVALUATION_REMINDERS);
  const times = plan.reminders.map(item => item.at);
  expect(times).toEqual([...times].sort((a, b) => a - b));
});

it('keeps a late reminder only while its text holds', () => {
  const plan = buildEvaluationReminderPlan(
    [evaluation({ reminders: ['day', 'h1'] })],
    { now: NOW, text },
  );
  const [day, hour] = plan.reminders;
  // "Hoje, 8:00" até o início; "Em 1 hora", 15 minutos
  expect(day.latest).toBe(new Date(2026, 10, 24, 8, 0).getTime());
  expect(hour.latest).toBe(new Date(2026, 10, 24, 7, 15).getTime());
  expect(hour.local.latest).toBe('2026-11-24T07:15');
});

it('drops the reminders the grades settled: the exam with a grade and the PF no longer needed', () => {
  const grades = new Map([
    ['342', { p1: 8, p2: 9 }],
    ['211', { p1: 5 }],
  ]);
  const plan = buildEvaluationReminderPlan(
    [
      evaluation({ id: 'pf-exempt', type: 'PF', date: '2026-12-10' }),
      evaluation({ id: 'p1-graded', subjectId: '211', type: 'P1' }),
      evaluation({
        id: 'pf-open',
        subjectId: '211',
        type: 'PF',
        date: '2026-12-10',
      }),
    ],
    { now: NOW, text, grades },
  );
  expect([...new Set(plan.reminders.map(item => item.evaluationId))]).toEqual([
    'pf-open',
  ]);
});
