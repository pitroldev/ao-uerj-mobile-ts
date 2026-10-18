import {
  focusManager,
  MutationCache,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import { MAX_CACHE_AGE } from '@root/adapters/outbound/persistence/query-account-cache';
import { isTransientError } from '@root/shared/errors/AppError';

/** Recebe toda falha final de query (com a chave) ou de mutation. */
type QueryErrorListener = (
  error: unknown,
  queryKey?: readonly unknown[],
) => void;

export function createQueryClient(onError?: QueryErrorListener) {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => onError?.(error, query.queryKey),
    }),
    mutationCache: new MutationCache({
      onError: error => onError?.(error),
    }),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        // The offline cache only saves queries still in memory: an unobserved
        // query (restored, or fetched by planning) must live as long as the
        // cache, not TanStack's 5-minute default.
        gcTime: MAX_CACHE_AGE,
        // With the screen in the background (focus follows AppState), the
        // network coming back does not refetch: the notification check
        // compares with what the student saw, and an unseen read would use
        // up the change. Returning to the app refetches what went stale.
        refetchOnReconnect: () => focusManager.isFocused(),
        retry: (failures, error) => failures < 1 && isTransientError(error),
        retryDelay: 1000,
      },
      mutations: { retry: false },
    },
  });
}
