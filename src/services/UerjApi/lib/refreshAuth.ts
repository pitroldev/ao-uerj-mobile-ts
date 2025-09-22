import store from '@root/store';
import * as apiConfigReducer from '@reducers/apiConfig';
import { handleLogin } from '@features/Login/core';
import { retry } from '@services/UerjApi/utils';

let inFlightRefresh: Promise<void> | null = null;
let consecutiveFailures = 0;

async function doRefresh(): Promise<void> {
  const { userInfo } = store.getState();
  if (!userInfo.matricula || !userInfo.password) {
    throw new Error('NOT_LOGGED_IN');
  }
  const data = await retry(async () =>
    handleLogin(userInfo.matricula as string, userInfo.password as string),
  );

  const failed =
    typeof data.fail_reason === 'string' && data.fail_reason.trim().length > 0;

  if (failed) {
    throw new Error('LOGIN_REFRESH_FAILED');
  }
}

export async function refreshAuth(): Promise<void> {
  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      try {
        await doRefresh();
        consecutiveFailures = 0;
      } catch (err) {
        consecutiveFailures += 1;
        if (consecutiveFailures >= 2) {
          store.dispatch(apiConfigReducer.clear());
          consecutiveFailures = 0;
          throw new Error('LOGIN_FAILED');
        }
        throw err;
      } finally {
        inFlightRefresh = null;
      }
    })();
  }

  return inFlightRefresh;
}
