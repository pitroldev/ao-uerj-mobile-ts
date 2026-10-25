import type { PreferencesStore } from '@root/modules/identity/application/PreferencesStore';
import type { Evaluation } from '../../domain/evaluations';
import { EVALUATIONS_KEY, EvaluationRecords } from '../EvaluationRecords';

function memoryStore(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial));
  // uma operação por vez, como a fila por chave do createPreferencesStore
  let queue: Promise<unknown> = Promise.resolve();
  const store: PreferencesStore = {
    read: async <T>(scope: string, key: string) =>
      (data.get(`${scope}:${key}`) as T | undefined) ?? null,
    write: async (scope, key, value) => {
      data.set(`${scope}:${key}`, JSON.parse(JSON.stringify(value)));
    },
    update: <T>(
      scope: string,
      key: string,
      change: (current: T | null) => T,
    ) => {
      const task = queue
        .catch(() => undefined)
        .then(async () => {
          const current =
            (data.get(`${scope}:${key}`) as T | undefined) ?? null;
          // um tique de atraso, como o AsyncStorage
          await Promise.resolve();
          const next = change(current);
          data.set(`${scope}:${key}`, JSON.parse(JSON.stringify(next)));
          return next;
        });
      queue = task;
      return task;
    },
    remove: async (scope, key) => {
      data.delete(`${scope}:${key}`);
    },
  };
  return { store, data };
}

const evaluation = (patch: Partial<Evaluation> = {}): Evaluation => ({
  id: 'e1',
  subjectId: '342',
  subjectName: 'Física III',
  type: 'P1',
  date: '2026-11-24',
  time: 480,
  note: '',
  reminders: ['eve', 'day'],
  earlyTime: 1200,
  dayTime: 420,
  done: false,
  ...patch,
});

it('keeps evaluations per account and period', async () => {
  const { store } = memoryStore();
  const records = new EvaluationRecords(store);
  await records.save('a', '2026.2', evaluation());
  await records.save('a', '2026.1', evaluation({ id: 'old' }));

  expect(await records.read('a', '2026.2')).toEqual([evaluation()]);
  expect((await records.read('a', '2026.1'))[0].id).toBe('old');
  expect(await records.read('b', '2026.2')).toEqual([]);
});

it('replaces the same exam, removes and marks done', async () => {
  const { store } = memoryStore();
  const records = new EvaluationRecords(store);
  await records.save('a', 'p', evaluation({ id: 'a' }));
  await records.save('a', 'p', evaluation({ id: 'w', type: 'work' }));
  const replaced = await records.save(
    'a',
    'p',
    evaluation({ id: 'b', date: '2026-11-26' }),
  );
  expect(replaced.map(item => item.id)).toEqual(['w', 'b']);

  const done = await records.setDone('a', 'p', ['w'], true);
  expect(done.find(item => item.id === 'w')?.done).toBe(true);
  expect(await records.remove('a', 'p', 'b')).toEqual([
    { ...evaluation({ id: 'w', type: 'work' }), done: true },
  ]);
});

it('saves two quick changes without losing one', async () => {
  const { store } = memoryStore();
  const records = new EvaluationRecords(store);
  await Promise.all([
    records.save('a', 'p', evaluation({ id: 'x', type: 'work' })),
    records.save('a', 'p', evaluation({ id: 'y', type: 'seminar' })),
  ]);
  expect((await records.read('a', 'p')).map(item => item.id)).toEqual([
    'x',
    'y',
  ]);
});

it('ignores a malformed copy', async () => {
  const { store } = memoryStore({
    [`a:${EVALUATIONS_KEY}`]: {
      version: 1,
      periods: { p: [evaluation(), { id: 'broken' }] },
    },
  });
  expect(await new EvaluationRecords(store).read('a', 'p')).toEqual([
    evaluation(),
  ]);
});
