import { QueryClient } from '@tanstack/react-query';
import { isTransientError } from '@root/shared/errors/AppError';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: (failures, error) => failures < 1 && isTransientError(error),
        retryDelay: 1000,
      },
      mutations: { retry: false },
    },
  });
}
