import { createStudentSessionStore } from '../student-session-store';

function vault(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    read: jest.fn(async (key: string) => items.get(key) ?? null),
    write: jest.fn(async (key: string, value: string) => {
      items.set(key, value);
    }),
    remove: jest.fn(async (key: string) => {
      items.delete(key);
    }),
    removePrefix: jest.fn(async () => undefined),
  };
}

it('keeps the session and the installation in the vault', async () => {
  const items = vault();
  const store = createStudentSessionStore(items);
  await expect(store.read()).resolves.toBeNull();
  const session = { token: 't', scope: 'account-a', expiresAt: 1 };
  await store.write(session);
  await expect(store.read()).resolves.toEqual(session);
  await store.writeInstallation('id');
  await expect(store.readInstallation()).resolves.toBe('id');
});

it('keeps the installation of the anonymous tokens and drops their stock on clear', async () => {
  const items = vault({
    'trust:installation': 'old-id',
    'trust:stock': '{"tokens":[]}',
    'trust:session': '{"token":"t","scope":"a","expiresAt":1}',
  });
  const store = createStudentSessionStore(items);
  await expect(store.readInstallation()).resolves.toBe('old-id');
  await store.clear();
  expect(items.items.has('trust:session')).toBe(false);
  expect(items.items.has('trust:stock')).toBe(false);
  expect(items.items.get('trust:installation')).toBe('old-id');
});

it('reads a broken item as no session', async () => {
  const store = createStudentSessionStore(
    vault({ 'trust:session': '{"token":1}' }),
  );
  await expect(store.read()).resolves.toBeNull();
  const broken = createStudentSessionStore(vault({ 'trust:session': '{' }));
  await expect(broken.read()).resolves.toBeNull();
});
