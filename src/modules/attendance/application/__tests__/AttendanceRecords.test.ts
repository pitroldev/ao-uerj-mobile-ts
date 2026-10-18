import type { PreferencesStore } from '@root/modules/identity/application/PreferencesStore';
import { ATTENDANCE_KEY, AttendanceRecords } from '../AttendanceRecords';

function memoryStore(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial));
  // uma operação por vez, como a fila por chave do createPreferencesStore
  let queue: Promise<unknown> = Promise.resolve();
  const store: PreferencesStore = {
    read: async <T>(scope: string, key: string) =>
      (data.get(`${scope}:${key}`) as T | undefined) ?? null,
    write: async (scope, key, value) => {
      // um tique de atraso, como o AsyncStorage
      await Promise.resolve();
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

const meeting = (date: string, start = 860) => ({
  subjectId: '778',
  date,
  start,
  end: start + 100,
  slots: 2,
});

it('keeps absences per account and period', async () => {
  const { store, data } = memoryStore();
  const records = new AttendanceRecords(store);
  await records.mark('a', '2026.1', meeting('2026-10-15'), true);
  await records.mark('a', '2026.2', meeting('2026-11-20'), true);

  expect(await records.read('a', '2026.1')).toEqual([
    { subjectId: '778', date: '2026-10-15', start: 860, end: 960, slots: 2 },
  ]);
  expect(await records.read('a', '2026.2')).toHaveLength(1);
  expect(await records.read('b', '2026.1')).toEqual([]);
  expect(data.get(`a:${ATTENDANCE_KEY}`)).toMatchObject({ version: 1 });
});

it('applies quick taps in order, without losing one', async () => {
  const { store } = memoryStore();
  const records = new AttendanceRecords(store);
  await Promise.all([
    records.mark('a', '2026.1', meeting('2026-10-15'), true),
    records.mark('a', '2026.1', meeting('2026-10-08'), true),
    records.mark('a', '2026.1', meeting('2026-10-15'), false),
  ]);
  expect(await records.read('a', '2026.1')).toEqual([
    { subjectId: '778', date: '2026-10-08', start: 860, end: 960, slots: 2 },
  ]);
});

it('drops malformed entries instead of failing', async () => {
  const { store } = memoryStore({
    [`a:${ATTENDANCE_KEY}`]: {
      version: 1,
      periods: {
        '2026.1': [
          {
            subjectId: '778',
            date: '2026-10-15',
            start: 860,
            end: 960,
            slots: 2,
          },
          { subjectId: '778', date: '15/10', start: 860, end: 960, slots: 2 },
          { subjectId: '', date: '2026-10-15', start: 860, end: 960, slots: 2 },
          {
            subjectId: '778',
            date: '2026-10-15',
            start: 860,
            end: 960,
            slots: 0,
          },
          { subjectId: '778', date: '2026-10-15', start: 860, slots: 2 },
          {
            subjectId: '778',
            date: '2026-10-15',
            start: 860,
            end: 860,
            slots: 2,
          },
          null,
        ],
      },
    },
  });
  expect(await new AttendanceRecords(store).read('a', '2026.1')).toHaveLength(
    1,
  );
  const { store: broken } = memoryStore({ [`a:${ATTENDANCE_KEY}`]: 'x' });
  expect(await new AttendanceRecords(broken).read('a', '2026.1')).toEqual([]);
});

it('recovers after a failed write', async () => {
  const { store } = memoryStore();
  const failing: PreferencesStore = {
    ...store,
    update: jest
      .fn()
      .mockRejectedValueOnce(new Error('disk'))
      .mockImplementation(store.update),
  };
  const records = new AttendanceRecords(failing);
  await expect(
    records.mark('a', '2026.1', meeting('2026-10-15'), true),
  ).rejects.toThrow('disk');
  await records.mark('a', '2026.1', meeting('2026-10-08'), true);
  expect(await records.read('a', '2026.1')).toHaveLength(1);
});
