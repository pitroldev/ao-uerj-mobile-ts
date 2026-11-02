import {
  testCrypto,
  testIssuer,
} from '@root/modules/trust/__tests__/testCrypto';
import { toBase64 } from '@root/modules/trust/domain/bytes';
import {
  blindToken,
  encodeChallenge,
  finalizeToken,
  parseTokenKey,
} from '@root/modules/trust/domain/privateToken';
import { createTokenStore } from '../token-store';
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
      // apagar durante a iteração de um Map é seguro
      for (const name of items.keys())
        if (name.startsWith(prefix)) items.delete(name);
    },
  };
  return { vault, items };
}

function token() {
  const issuer = testIssuer();
  const key = parseTokenKey(testCrypto, issuer.tokenKey)!;
  const blinded = blindToken(testCrypto, key, encodeChallenge());
  return toBase64(
    finalizeToken(testCrypto, key, blinded, issuer.sign(blinded.request))!,
    { url: true },
  );
}

it('keeps the stock and the installation in encrypted vault items', async () => {
  const { vault, items } = memoryVault();
  const store = createTokenStore(vault);
  await expect(store.readStock()).resolves.toBeNull();
  await expect(store.readInstallation()).resolves.toBeNull();

  const stock = { tokens: [token()], retryAt: 1700000000000 };
  await store.writeStock(stock);
  await store.writeInstallation('aW5zdGFsYcOnw6Nv');
  await expect(store.readStock()).resolves.toEqual(stock);
  await expect(store.readInstallation()).resolves.toBe('aW5zdGFsYcOnw6Nv');
  expect([...items.keys()].sort()).toEqual([
    'trust:installation',
    'trust:stock',
  ]);

  // vazio e sem espera, o item some
  await store.writeStock({ tokens: [], retryAt: null });
  expect(items.has('trust:stock')).toBe(false);
});

it('reads a damaged stock as none', async () => {
  const { vault, items } = memoryVault();
  const store = createTokenStore(vault);
  items.set('trust:stock', '{"tokens":');
  await expect(store.readStock()).resolves.toBeNull();
  items.set('trust:stock', '{"tokens":"x","retryAt":null}');
  await expect(store.readStock()).resolves.toBeNull();
});
