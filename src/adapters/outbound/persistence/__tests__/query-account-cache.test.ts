import {
  environmentManager,
  isServer,
  QueryClient,
} from '@tanstack/react-query';
import { createQueryClient } from '@root/app/queryClient';
import { createQueryAccountCache, MAX_CACHE_AGE } from '../query-account-cache';
import type { KeyValueStorage } from '../storage';

function setup(
  records = new Map<string, string>(),
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  }),
) {
  const storage: KeyValueStorage = {
    getItem: async key => records.get(key) ?? null,
    setItem: async (key, value) => {
      records.set(key, value);
    },
    removeItem: async key => {
      records.delete(key);
    },
  };
  const cache = createQueryAccountCache(client, storage);
  return { records, storage, client, cache };
}

it('persists only successful academic data belonging to the active account', async () => {
  const { cache, client, records } = setup();
  await cache.lifecycle.activate('a');
  client.setQueryData(['academics', 'a', 'grades'], ['saved']);
  client.setQueryData(['academics', 'b', 'grades'], ['other-user']);
  client.setQueryData(['login'], { password: 'synthetic-secret' });
  await cache.flush();
  const raw = records.get('ao:v2:academic-cache:a')!;
  expect(raw).toContain('saved');
  expect(raw).not.toMatch(/other-user|synthetic-secret/);
  cache.dispose();
  client.clear();
});

it('hydrates account A offline without publishing it to account B', async () => {
  const first = setup();
  await first.cache.lifecycle.activate('a');
  first.client.setQueryData(['academics', 'a', 'history'], [{ id: 'test' }]);
  await first.cache.flush();
  first.cache.dispose();
  first.client.clear();
  const second = setup(first.records);
  await second.cache.lifecycle.activate('b');
  expect(second.client.getQueryCache().getAll()).toHaveLength(0);
  await second.cache.lifecycle.activate('a');
  expect(second.client.getQueryData(['academics', 'a', 'history'])).toEqual([
    { id: 'test' },
  ]);
  second.cache.dispose();
  second.client.clear();
});

it('retains successful data after a failed refresh without persisting the error', async () => {
  const { cache, client, records } = setup();
  await cache.lifecycle.activate('a');
  const queryKey = ['academics', 'a', 'history'];
  client.setQueryData(queryKey, ['last-success']);
  await client
    .fetchQuery({
      queryKey,
      queryFn: async () => {
        throw new Error('unsafe-request-secret');
      },
      retry: false,
    })
    .catch(() => undefined);
  await cache.flush();
  const raw = records.get('ao:v2:academic-cache:a')!;
  expect(raw).toContain('last-success');
  expect(raw).not.toContain('unsafe-request-secret');
  cache.dispose();
  client.clear();
});

it('removes cache after waiting for an already running disk write on logout', async () => {
  const { storage, cache, client, records } = setup();
  await cache.lifecycle.activate('a');
  let started!: () => void;
  const writing = new Promise<void>(resolve => {
    started = resolve;
  });
  let finish!: () => void;
  storage.setItem = async (key, value) => {
    started();
    await new Promise<void>(resolve => {
      finish = resolve;
    });
    records.set(key, value);
  };
  client.setQueryData(['academics', 'a', 'grades'], ['private']);
  const flush = cache.flush();
  await writing;
  const logout = cache.lifecycle.clear('a');
  finish();
  await flush;
  await logout;
  expect(records.size).toBe(0);
  expect(client.getQueryCache().getAll()).toHaveLength(0);
  cache.dispose();
});

it('discards expired, malformed and foreign-scope cached queries', async () => {
  const { cache, client, records } = setup();
  records.set(
    'ao:v2:academic-cache:a',
    JSON.stringify({
      version: 2,
      savedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      state: { queries: [], mutations: [] },
    }),
  );
  await cache.lifecycle.activate('a');
  expect(client.getQueryCache().getAll()).toHaveLength(0);
  records.set('ao:v2:academic-cache:a', '{bad');
  await cache.lifecycle.activate('a');
  expect(records.has('ao:v2:academic-cache:a')).toBe(false);
  cache.dispose();
  client.clear();
});

describe('queries that no screen observes', () => {
  const HISTORY = ['academics', 'a', 'history'];
  const DETAILS = ['academics', 'a', 'subject-details', 'IME02-10892'];
  // Far beyond TanStack's 5-minute default, still inside the cache window.
  const ALMOST_EXPIRED = MAX_CACHE_AGE - 60 * 60 * 1000;

  beforeEach(() => {
    // React Native defines `window`, so on the device TanStack collects
    // unobserved queries. Under Jest's node environment it assumes a server
    // and never collects them, which would hide the bug.
    environmentManager.setIsServer(() => false);
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    environmentManager.setIsServer(() => isServer);
  });

  /** Saves the history in a previous session and restores it into `client`. */
  async function restoreHistory(client: QueryClient) {
    const previous = setup();
    await previous.cache.lifecycle.activate('a');
    previous.client.setQueryData(HISTORY, ['saved-history']);
    await previous.cache.flush();
    previous.cache.dispose();
    previous.client.clear();
    const next = setup(previous.records, client);
    await next.cache.lifecycle.activate('a');
    return next;
  }

  it('stay in memory and on disk until the cache expires (production client)', async () => {
    const { cache, client, records } =
      await restoreHistory(createQueryClient());
    // Fetched without an observer, as the planning screen does.
    await client.fetchQuery({
      queryKey: DETAILS,
      queryFn: async () => ['fetched-details'],
    });
    jest.advanceTimersByTime(ALMOST_EXPIRED);
    await cache.flush();
    expect(client.getQueryData(HISTORY)).toEqual(['saved-history']);
    expect(client.getQueryData(DETAILS)).toEqual(['fetched-details']);
    const raw = records.get('ao:v2:academic-cache:a')!;
    expect(raw).toContain('saved-history');
    expect(raw).toContain('fetched-details');
    cache.dispose();
    client.clear();
  });

  it('stay after being restored even when the client collects after 5 minutes', async () => {
    const { cache, client, records } = await restoreHistory(new QueryClient());
    jest.advanceTimersByTime(ALMOST_EXPIRED);
    await cache.flush();
    expect(client.getQueryData(HISTORY)).toEqual(['saved-history']);
    expect(records.get('ao:v2:academic-cache:a')).toContain('saved-history');
    cache.dispose();
    client.clear();
  });
});
