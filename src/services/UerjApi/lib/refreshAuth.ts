import store from '@root/store';
import * as apiConfigReducer from '@reducers/apiConfig';

import {handleLogin} from '../../../features/Login/handleLogin';
import {retry} from '@services/UerjApi/utils';

export async function refreshAuth(): Promise<void> {
  store.dispatch(apiConfigReducer.clear());

  const {userInfo} = store.getState();
  const data = await retry(
    async () =>
      await handleLogin(
        userInfo.matricula as string,
        userInfo.password as string,
      ),
  );

  const hasFailed = data.fail_reason !== null;
  if (hasFailed) {
    throw new Error('LOGIN_FAILED');
  }
}
