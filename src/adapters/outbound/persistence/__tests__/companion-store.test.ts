import type { Membership } from '@root/modules/companion/domain/companion';
import { createCompanionStore } from '../companion-store';
import type { SecureVault } from '../vault-storage';

function memoryVault() {
  const items = new Map<string, string>();
  const vault: SecureVault = {
    read: async name => items.get(name) ?? null,
    write: async (name, value) => {
      items.set(name, value);
    },
    remove: async name => {
      items.delete(name);
    },
    removePrefix: async prefix => {
      [...items.keys()]
        .filter(name => name.startsWith(prefix))
        .forEach(name => items.delete(name));
    },
  };
  return { items, vault };
}

const MEMBERSHIP: Membership = {
  callId: 'abc',
  memberKey: 'secret',
  host: true,
  kind: 'home',
  at: 1000,
  spot: 'portao-1',
  destination: 'trem',
  expiresAt: 2000,
};

it('keeps the memberships in one vault item and removes it when empty', async () => {
  const { items, vault } = memoryVault();
  const store = createCompanionStore(vault);
  await store.write([MEMBERSHIP]);
  expect(await store.read()).toEqual([MEMBERSHIP]);
  await store.write([]);
  expect(items.size).toBe(0);
  expect(await store.read()).toEqual([]);
});

it('leaves out what is not a membership', async () => {
  const { items, vault } = memoryVault();
  items.set(
    'companion:memberships',
    JSON.stringify([
      MEMBERSHIP,
      { ...MEMBERSHIP, spot: 'casa' },
      { ...MEMBERSHIP, memberKey: 3 },
      'texto',
    ]),
  );
  expect(await createCompanionStore(vault).read()).toEqual([MEMBERSHIP]);
  items.set('companion:memberships', '{quebrado');
  expect(await createCompanionStore(vault).read()).toEqual([]);
});
