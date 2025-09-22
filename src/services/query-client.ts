import { QueryClient } from 'react-query';

export const NOT_RETRY_ERRORS = ['NOT_LOGGED_IN', 'POSSIBLY_BLOCKED'];
const MAX_RETRIES = 3;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: (failureCount, error: any) => {
        return (
          !NOT_RETRY_ERRORS.includes(error.message) &&
          failureCount < MAX_RETRIES
        );
      },
    },
  },
});

export default queryClient;
