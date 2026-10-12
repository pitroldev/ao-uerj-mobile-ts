import {
  dehydrate,
  hydrate,
  type DehydratedState,
  type QueryClient,
} from '@tanstack/react-query';
import type { AccountDataLifecycle } from '@root/modules/identity/application/ports';
import type { KeyValueStorage } from './storage';

const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000;

/** Only academic query data is cached. Credentials and transport never enter it. */
export function createQueryAccountCache(
  queryClient: QueryClient,
  storage: KeyValueStorage,
  clearPreferences: (scope: string) => Promise<void> = async () => {},
) {
  let scope: string | null = null;
  let revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writes: Promise<void> = Promise.resolve();
  const key = (account: string) => `ao:v2:academic-cache:${account}`;
  const isAccountQuery = (queryKey: readonly unknown[], account: string) =>
    queryKey[0] === 'academics' && queryKey[1] === account;

  function flush(): Promise<void> {
    if (timer) clearTimeout(timer);
    timer = undefined;
    const account = scope;
    const version = revision;
    if (!account) return writes;
    const state = dehydrate(queryClient, {
      shouldDehydrateMutation: () => false,
      shouldDehydrateQuery: query =>
        isAccountQuery(query.queryKey, account) &&
        query.state.data !== undefined &&
        Date.now() - query.state.dataUpdatedAt <= MAX_CACHE_AGE,
    });
    // A failed background refresh must not erase the last successful data,
    // and errors/request objects must never be serialized to disk.
    state.queries = state.queries.map(query => ({
      queryKey: query.queryKey,
      queryHash: query.queryHash,
      dehydratedAt: query.dehydratedAt,
      state: {
        ...query.state,
        status: 'success',
        fetchStatus: 'idle',
        error: null,
        errorUpdatedAt: 0,
        fetchFailureCount: 0,
        fetchFailureReason: null,
      },
    }));
    writes = writes
      .catch(() => undefined)
      .then(async () => {
        if (scope !== account || revision !== version) return;
        await storage.setItem(
          key(account),
          JSON.stringify({ version: 2, savedAt: Date.now(), state }),
        );
      });
    return writes;
  }

  const unsubscribe = queryClient.getQueryCache().subscribe(event => {
    if (!scope || !isAccountQuery(event.query.queryKey, scope)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void flush().catch(() => undefined);
    }, 200);
  });

  const lifecycle: AccountDataLifecycle = {
    async activate(account) {
      const version = ++revision;
      scope = account;
      const raw = await storage.getItem(key(account));
      if (!raw || scope !== account || revision !== version) return;
      try {
        const cached = JSON.parse(raw) as {
          version: number;
          savedAt: number;
          state: DehydratedState;
        };
        if (
          cached.version !== 2 ||
          !Number.isFinite(cached.savedAt) ||
          Date.now() - cached.savedAt > MAX_CACHE_AGE
        )
          return;
        const queries = cached.state.queries.filter(
          query =>
            isAccountQuery(query.queryKey, account) &&
            Number.isFinite(query.state.dataUpdatedAt) &&
            Date.now() - query.state.dataUpdatedAt <= MAX_CACHE_AGE,
        );
        hydrate(queryClient, { mutations: [], queries });
      } catch {
        await storage.removeItem(key(account));
      }
    },
    async clear(account) {
      const activeAccount = scope;
      ++revision;
      scope = null;
      if (timer) clearTimeout(timer);
      timer = undefined;
      await queryClient.cancelQueries();
      queryClient.clear();
      await writes.catch(() => undefined);
      const owners = new Set(
        [account, activeAccount].filter(
          (value): value is string => value !== null,
        ),
      );
      await Promise.all(
        [...owners].flatMap(owner => [
          storage.removeItem(key(owner)),
          clearPreferences(owner),
        ]),
      );
    },
  };
  return {
    lifecycle,
    flush,
    dispose() {
      unsubscribe();
      if (timer) clearTimeout(timer);
    },
  };
}
