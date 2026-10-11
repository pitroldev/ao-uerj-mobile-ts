import { createPreferencesStore } from '../preferences';

it('removes the account preference after a late in-flight write finishes', async () => {
  const records = new Map<string, string>();
  let finish!: () => void;
  let started!: () => void;
  const reached = new Promise<void>(resolve => {
    started = resolve;
  });
  const preferences = createPreferencesStore({
    getItem: async key => records.get(key) ?? null,
    setItem: async (key, value) => {
      started();
      await new Promise<void>(resolve => {
        finish = resolve;
      });
      records.set(key, value);
    },
    removeItem: async key => {
      records.delete(key);
    },
  });
  const writing = preferences.write('account-a', 'credits', 15);
  await reached;
  const logout = preferences.remove('account-a', 'credits');
  finish();
  await Promise.all([writing, logout]);
  expect(records.size).toBe(0);
  expect(await preferences.read('account-a', 'credits')).toBeNull();
});

it('does not block account B or cleanup after a rejected write for account A', async () => {
  const records = new Map<string, string>();
  const preferences = createPreferencesStore({
    getItem: async key => records.get(key) ?? null,
    setItem: async (key, value) => {
      if (key.includes('account-a'))
        throw new Error('native sensitive details');
      records.set(key, value);
    },
    removeItem: async key => {
      records.delete(key);
    },
  });
  await expect(
    preferences.write('account-a', 'credits', 15),
  ).rejects.toMatchObject({ message: 'STORAGE_FAILED' });
  await preferences.write('account-b', 'credits', 12);
  await preferences.remove('account-a', 'credits');
  expect(await preferences.read('account-b', 'credits')).toBe(12);
});
