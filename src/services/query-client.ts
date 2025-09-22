import { QueryClient } from 'react-query';

export const NOT_RETRY_ERRORS = [
  'NOT_LOGGED_IN',
  'POSSIBLY_BLOCKED',
  'LOGIN_REFRESH_FAILED',
];
const MAX_RETRIES = 3;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false,
      retry: (failureCount, error: any) => {
        const status = error?.response?.status ?? error?.status;
        if (typeof status === 'number' && status >= 500) return false;

        return (
          !NOT_RETRY_ERRORS.includes(error.message) &&
          failureCount < MAX_RETRIES
        );
      },
    },
  },
});

export default queryClient;
