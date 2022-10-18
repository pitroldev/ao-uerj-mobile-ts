import store from '@root/store';
import * as apiConfigReducer from '@reducers/apiConfig';

import {handleLogin} from '@root/features/Login/core';
import {retry} from '@services/UerjApi/utils';

export async function handleRefreshAuth(): Promise<void> {
  const {userInfo} = store.getState();
  const data = await retry(async () => {
    return await handleLogin(
      userInfo.matricula as string,
      userInfo.password as string,
    );
  });

  const hasFailed =
    typeof data.fail_reason === 'string' && data.fail_reason.trim().length > 0;
  if (hasFailed) {
    store.dispatch(apiConfigReducer.clear());
    throw new Error('LOGIN_FAILED');
  }
}

let refresh: ReturnType<typeof handleRefreshAuth>;
let isRefreshing = false;

export async function refreshAuth(): Promise<void> {
  try {
    if (isRefreshing) {
      await refresh;
      return;
    }

    isRefreshing = true;
    refresh = handleRefreshAuth();
    await refresh;
  } catch (err) {
    throw err;
  } finally {
    isRefreshing = false;
  }
}
