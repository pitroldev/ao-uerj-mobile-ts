import type { SavedAccount } from '@root/modules/identity/domain/types';
import {
  forgetCredentialsOfPreviousInstall,
  INSTALL_MARKER,
} from '../previous-install';

const SAVED: SavedAccount = {
  credentials: { matricula: '1', password: 'senha-ficticia' },
  account: {
    matricula: '1',
    name: 'Estudante',
    period: '2026.2',
    scope: 'account-a',
  },
};

function setup(keys: Record<string, string>, saved: SavedAccount | null) {
  const items = new Map(Object.entries(keys));
  const storage = {
    getAllKeys: jest.fn(async () => [...items.keys()]),
    getItem: jest.fn(async (key: string) => items.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      items.set(key, value);
    }),
  };
  const credentials = {
    read: jest.fn(async () => saved),
    clear: jest.fn(async () => undefined),
  };
  return { items, storage, credentials };
}

it('forgets an account that came back from the keychain after a reinstall', async () => {
  // só o que a abertura já gravou (o aviso remoto), nada da conta
  const { items, storage, credentials } = setup(
    { 'ao:v1:app:remote-status': '{}' },
    SAVED,
  );
  await forgetCredentialsOfPreviousInstall(storage, credentials);
  expect(credentials.clear).toHaveBeenCalledTimes(1);
  expect(items.has(INSTALL_MARKER)).toBe(true);
});

it('keeps the account on an update, with its data in the storage', async () => {
  const withCache = setup({ 'ao:v2:academic-cache:account-a': '{}' }, SAVED);
  await forgetCredentialsOfPreviousInstall(
    withCache.storage,
    withCache.credentials,
  );
  expect(withCache.credentials.clear).not.toHaveBeenCalled();

  const withPreferences = setup(
    { 'ao:v2:preferences:account-a:app-info-version': '"2.9.0"' },
    SAVED,
  );
  await forgetCredentialsOfPreviousInstall(
    withPreferences.storage,
    withPreferences.credentials,
  );
  expect(withPreferences.credentials.clear).not.toHaveBeenCalled();
});

it('decides once per installation', async () => {
  const { storage, credentials } = setup({ [INSTALL_MARKER]: '1' }, SAVED);
  await forgetCredentialsOfPreviousInstall(storage, credentials);
  expect(credentials.read).not.toHaveBeenCalled();
  expect(credentials.clear).not.toHaveBeenCalled();
});

it('tries again on the next opening when the keychain fails', async () => {
  const { items, storage, credentials } = setup({}, SAVED);
  credentials.clear.mockRejectedValueOnce(new Error('keychain'));
  await expect(
    forgetCredentialsOfPreviousInstall(storage, credentials),
  ).resolves.toBeUndefined();
  expect(items.has(INSTALL_MARKER)).toBe(false);
});

it('only marks the installation without a saved account', async () => {
  const { items, storage, credentials } = setup({}, null);
  await forgetCredentialsOfPreviousInstall(storage, credentials);
  expect(credentials.clear).not.toHaveBeenCalled();
  expect(items.has(INSTALL_MARKER)).toBe(true);
});
