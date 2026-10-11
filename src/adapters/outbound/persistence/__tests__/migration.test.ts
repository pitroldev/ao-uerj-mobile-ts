import { migrateLegacyStorage } from '../migrate-legacy';
import { createPreferencesStore } from '../preferences';
import type { KeyValueStorage } from '../storage';
import type { CredentialStore } from '@root/modules/identity/application/ports';
import type { SavedAccount } from '@root/modules/identity/domain/types';

const user = {
  matricula: 'synthetic-student',
  password: 'synthetic-secret',
  name: 'Aluno fictício',
  periodo: '2026.2',
};

function setup() {
  const records = new Map<string, string>([
    [
      'persist:root',
      JSON.stringify({
        userInfo: JSON.stringify(user),
        apiConfig: JSON.stringify({ _token: 'synthetic-token' }),
      }),
    ],
    [
      '@elective_credits_config',
      JSON.stringify({ RESTRICTED: 10, DEFINED: 4, UNIVERSAL: 8 }),
    ],
  ]);
  const storage: KeyValueStorage = {
    getItem: async key => records.get(key) ?? null,
    setItem: async (key, value) => {
      records.set(key, value);
    },
    removeItem: async key => {
      records.delete(key);
    },
  };
  let saved: SavedAccount | null = null;
  const vault: jest.Mocked<CredentialStore> = {
    read: jest.fn(async () => saved),
    write: jest.fn(async next => {
      saved = next;
    }),
    clear: jest.fn(async () => {
      saved = null;
    }),
  };
  const preferences = createPreferencesStore(storage);
  const run = () =>
    migrateLegacyStorage(storage, vault, preferences, () => 'local-scope');
  return { records, storage, vault, preferences, run };
}

it('migrates credentials to the vault and only scoped preferences to plain storage', async () => {
  const { run, records, vault, preferences } = setup();
  await run();
  expect((await vault.read())?.credentials).toEqual({
    matricula: user.matricula,
    password: user.password,
  });
  expect(await preferences.read('local-scope', 'elective-credits')).toEqual({
    RESTRICTED: 10,
    DEFINED: 4,
    UNIVERSAL: 8,
  });
  expect(records.has('persist:root')).toBe(false);
  expect(records.has('@elective_credits_config')).toBe(false);
  expect(JSON.stringify([...records])).not.toMatch(
    /synthetic-secret|synthetic-token|synthetic-student/,
  );
});

it('is idempotent after a completed or interrupted transfer', async () => {
  const { run, records, vault } = setup();
  const oldRoot = records.get('persist:root')!;
  await run();
  const first = await vault.read();
  records.set('persist:root', oldRoot);
  await run();
  await run();
  expect(await vault.read()).toEqual(first);
  expect(vault.write).toHaveBeenCalledTimes(1);
});

it('removes insecure credentials even when secure transfer fails', async () => {
  const { run, records, vault } = setup();
  vault.write.mockRejectedValueOnce(new Error('native failure'));
  await expect(run()).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
  expect(records.size).toBe(0);
});

it('removes a partially persisted credential if verification fails after writing', async () => {
  const { run, vault, records } = setup();
  const write = vault.write.getMockImplementation()!;
  vault.write.mockImplementationOnce(async value => {
    await write(value);
    throw new Error('verification read failed');
  });
  await expect(run()).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
  expect(await vault.read()).toBeNull();
  expect(records.has('persist:root')).toBe(false);
});

it('does not assign unknown or another account preferences to an existing account', async () => {
  const { run, records, vault } = setup();
  await vault.write({
    credentials: { matricula: 'other', password: 'test' },
    account: {
      scope: 'other-scope',
      matricula: 'other',
      name: 'Outro',
      period: '2026.2',
    },
  });
  await run();
  expect(records.size).toBe(0);
  expect((await vault.read())?.account.scope).toBe('other-scope');
});

it('purges orphan preferences and malformed legacy data', async () => {
  const { run, records } = setup();
  records.delete('persist:root');
  await run();
  expect(records.size).toBe(0);
  records.set('persist:root', '{bad json');
  await expect(run()).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
  expect(records.size).toBe(0);
});
