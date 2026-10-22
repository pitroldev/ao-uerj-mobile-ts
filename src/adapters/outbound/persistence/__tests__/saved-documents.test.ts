import type { SavedDocument } from '@root/modules/documents/domain/models';
import { createVaultStorage, type SecureVault } from '../vault-storage';
import {
  createSavedDocumentsStore,
  MAX_SAVED_DOCUMENTS,
} from '../saved-documents';
import type { KeyValueStorage } from '../storage';

function memoryVault(failing = false) {
  const items = new Map<string, string>();
  const vault: SecureVault = {
    read: jest.fn(async name => {
      if (failing) throw new Error('keystore');
      return items.get(name) ?? null;
    }),
    write: jest.fn(async (name, value) => {
      if (failing) throw new Error('keystore');
      items.set(name, value);
    }),
    remove: jest.fn(async name => {
      items.delete(name);
    }),
    removePrefix: jest.fn(async prefix => {
      [...items.keys()]
        .filter(name => name.startsWith(prefix))
        .forEach(name => items.delete(name));
    }),
  };
  return { vault, items };
}

const document = (id: string, savedAt = 1): SavedDocument => ({
  id,
  title: `Declaração ${id}`,
  validUntil: '30/11/2026',
  savedAt,
  pdf: {
    base64: 'JVBERi0=',
    filename: `${id}.pdf`,
    mimeType: 'application/pdf',
  },
});

it('keeps the newest documents of each account in the vault', async () => {
  const { vault, items } = memoryVault();
  const store = createSavedDocumentsStore(vault);
  for (let index = 0; index <= MAX_SAVED_DOCUMENTS; index += 1)
    await store.save('account-a', document(`d${index}`, index));
  const saved = await store.list('account-a');
  expect(saved.map(item => item.id)).toEqual(['d5', 'd4', 'd3', 'd2', 'd1']);
  // guardar de novo substitui, no topo
  await store.save('account-a', document('d3', 9));
  expect((await store.list('account-a')).map(item => item.id)).toEqual([
    'd3',
    'd5',
    'd4',
    'd2',
    'd1',
  ]);
  expect(await store.list('account-b')).toEqual([]);
  expect([...items.keys()]).toEqual(['documents:account-a']);
});

it('removes one document, and the item with the last one', async () => {
  const { vault, items } = memoryVault();
  const store = createSavedDocumentsStore(vault);
  await store.save('account-a', document('d1'));
  await store.save('account-a', document('d2'));
  await store.remove('account-a', 'd1');
  expect((await store.list('account-a')).map(item => item.id)).toEqual(['d2']);
  await store.remove('account-a', 'd2');
  expect(items.size).toBe(0);
  await store.save('account-a', document('d3'));
  await store.clear('account-a');
  expect(items.size).toBe(0);
});

it('drops what it cannot read instead of failing', async () => {
  const { vault, items } = memoryVault();
  const store = createSavedDocumentsStore(vault);
  items.set('documents:account-a', 'not json');
  await expect(store.list('account-a')).resolves.toEqual([]);
  items.set(
    'documents:account-a',
    JSON.stringify([document('ok'), { id: 'broken' }]),
  );
  expect((await store.list('account-a')).map(item => item.id)).toEqual(['ok']);
  await expect(
    createSavedDocumentsStore(memoryVault(true).vault).list('account-a'),
  ).resolves.toEqual([]);
});

describe('academic cache in the vault', () => {
  function legacyStorage(initial: Record<string, string> = {}) {
    const items = new Map(Object.entries(initial));
    const storage: KeyValueStorage = {
      getItem: jest.fn(async key => items.get(key) ?? null),
      setItem: jest.fn(async (key, value) => {
        items.set(key, value);
      }),
      removeItem: jest.fn(async key => {
        items.delete(key);
      }),
    };
    return { storage, items };
  }

  it('reads the old plain copy once and erases it on the first write', async () => {
    const { vault, items: encrypted } = memoryVault();
    const legacy = legacyStorage({ cache: 'old' });
    const storage = createVaultStorage(vault, legacy.storage);
    await expect(storage.getItem('cache')).resolves.toBe('old');
    await storage.setItem('cache', 'new');
    expect(encrypted.get('cache')).toBe('new');
    expect(legacy.items.has('cache')).toBe(false);
    await expect(storage.getItem('cache')).resolves.toBe('new');
    await storage.removeItem('cache');
    expect(encrypted.has('cache')).toBe(false);
  });

  it('never blocks the app when the vault fails', async () => {
    const legacy = legacyStorage({ cache: 'old' });
    const storage = createVaultStorage(memoryVault(true).vault, legacy.storage);
    await expect(storage.getItem('cache')).resolves.toBe('old');
    // sem gravar no cofre, a cópia antiga fica
    await expect(storage.setItem('cache', 'new')).resolves.toBeUndefined();
    expect(legacy.items.get('cache')).toBe('old');
  });
});
