import store from '@root/store';
import * as apiConfigReducer from '@reducers/apiConfig';
import { handleLogin } from '@features/Login/core';
import { retry } from '@services/UerjApi/utils';

let inFlightRefresh: Promise<void> | null = null;
let consecutiveFailures = 0;
let lastRefreshAt = 0;
const MIN_REFRESH_INTERVAL_MS = 10_000;

async function doRefresh(): Promise<void> {
  const { userInfo } = store.getState();
  if (!userInfo.matricula || !userInfo.password) {
    store.dispatch(apiConfigReducer.clear());
    throw new Error('NOT_LOGGED_IN');
  }
  const data = await retry(async () =>
    handleLogin(userInfo.matricula as string, userInfo.password as string, {
      isRefresh: true,
    }),
  );

  const failed =
    typeof data.fail_reason === 'string' && data.fail_reason.trim().length > 0;

  if (failed) {
    console.log('Login refresh failed:', data.fail_reason);
    store.dispatch(apiConfigReducer.clear());
    throw new Error('LOGIN_FAILED');
  }
}

export async function refreshAuth(): Promise<void> {
  const now = Date.now();
  if (now - lastRefreshAt < MIN_REFRESH_INTERVAL_MS && inFlightRefresh) {
    return inFlightRefresh; // reuse current promise if throttled
  }

  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      try {
        await doRefresh();
        consecutiveFailures = 0;
        lastRefreshAt = Date.now();
      } catch (err) {
        consecutiveFailures += 1;
        if (consecutiveFailures >= 2) {
          consecutiveFailures = 0;
          throw new Error('LOGIN_REFRESH_FAILED');
        }
        throw err;
      } finally {
        inFlightRefresh = null;
      }
    })();
  }

  return inFlightRefresh;
}
