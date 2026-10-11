import { QueryClient } from '@tanstack/react-query';
import { NOT_RETRY_ERRORS } from './UerjApi/errors';

export { NOT_RETRY_ERRORS } from './UerjApi/errors';
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
