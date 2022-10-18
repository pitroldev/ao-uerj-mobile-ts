import {AxiosError} from 'axios';

import store from '@root/store';
import * as apiConfigReducer from '@reducers/apiConfig';

import {refreshAuth} from '../lib/refreshAuth';

export const MAX_RETRIES = 3;

export const NOT_RETRY_ERRORS = ['NOT_LOGGED_IN', 'POSSIBLY_BLOCKED'];

export const SESSION_TIMED_OUT_ERRORS = [
  'REQ_ID_NOT_FOUND',
  'SUBJECT_REQ_ID_NOT_FOUND',
];

export async function retry<T>(
  fn: () => Promise<T>,
  count: number = MAX_RETRIES,
): Promise<T> {
  return await fn().catch(async (err: Error & AxiosError) => {
    if (err.message === 'POSSIBLY_BLOCKED') {
      store.dispatch(apiConfigReducer.setIsBlocked(true));
    }

    if (NOT_RETRY_ERRORS.includes(err.message)) {
      throw err;
    }

    const isSessionPossiblyExpired = err?.response?.status;
    const isFirstRetry = count === MAX_RETRIES;

    if (isSessionPossiblyExpired && isFirstRetry) {
      await refreshAuth();
    }

    if (count > 0) {
      return await retry(fn, count - 1);
    }

    throw err;
  });
}
