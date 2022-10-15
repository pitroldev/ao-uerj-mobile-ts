import store from '@root/store';
import * as apiConfigReducer from '@reducers/apiConfig';

import {handleLogin} from '@root/features/Login/core';
import {retry} from '@services/UerjApi/utils';

export async function refreshAuth(): Promise<void> {
  console.log('REFRESHING AUTH');
  const {userInfo} = store.getState();
  const data = await retry(async () => {
    console.log('HANDLE LOGIN');

    return await handleLogin(
      userInfo.matricula as string,
      userInfo.password as string,
    );
  });

  const hasFailed =
    typeof data.fail_reason === 'string' && data.fail_reason.trim().length > 0;
  if (hasFailed) {
    console.log('LOGIN FAILED', {data});
    store.dispatch(apiConfigReducer.clear());
    throw new Error('LOGIN_FAILED');
  }
}
