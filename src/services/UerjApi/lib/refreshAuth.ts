import store from '@root/store';
import * as apiConfigReducer from '@reducers/apiConfig';
import { handleLogin } from '@features/Login/core';
import { retry } from '../utils/retry';

let inFlightRefresh: Promise<void> | null = null;

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

  if (!('nome' in data) || !data.nome || data.fail_reason?.trim()) {
    store.dispatch(apiConfigReducer.clear());
    throw new Error('LOGIN_FAILED');
  }
}

export function refreshAuth(): Promise<void> {
  if (!inFlightRefresh) {
    inFlightRefresh = doRefresh().finally(() => {
      inFlightRefresh = null;
    });
  }

  return inFlightRefresh;
}
