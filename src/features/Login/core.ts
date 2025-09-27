import authApi from '@services/UerjApi/authApi';
import { retry } from '@services/UerjApi/utils';
import { clearAllCookies, getCookies } from '@services/cookies';

import store from '@root/store';
import * as apiConfigReducer from '@reducers/apiConfig';
import * as userInfoReducer from '@reducers/userInfo';

import parseLoginReqId from './parseLoginReqId';
import parseLoginInfo from './parseLoginData';
import { getReqIds } from './parseReqIds';

type HandleLoginOptions = {
  /** When true, indicates this login is a background session refresh
   *  and existing auth cookies should be reused instead of forcibly
   *  clearing them (which can create race conditions with in-flight
   *  requests and cause 401 loops). */
  isRefresh?: boolean;
};

async function setLoginCookie(): Promise<void> {
  const url = '/';
  await authApi.get(url);
}

export async function fetchLoginPage(): Promise<string> {
  const url = '/requisicaoaluno/';

  const { data } = await authApi.get(url);

  return data as string;
}

export async function handleLogin(
  matricula: string,
  senha: string,
  options: HandleLoginOptions = {},
) {
  const { isRefresh } = options;

  // For foreground (user‑initiated) login we fully clear cookies to avoid
  // session contamination. For silent refresh we intentionally DO NOT clear
  // cookies, because doing so while other fetches are in flight can drop
  // the session mid-request and trigger cascading 401/403 loops.
  if (!isRefresh) {
    await clearAllCookies();
  }

  await setLoginCookie();
  const loginPageData = await retry(fetchLoginPage);

  const { loginReqId, _token } = await parseLoginReqId(loginPageData);

  const url = '/requisicaoaluno/';
  const { data: homePageData } = await retry(async () =>
    authApi.get(url, {
      params: {
        requisicao: loginReqId,
        matricula,
        senha,
        _token,
      },
    }),
  );

  const info = parseLoginInfo(homePageData);

  if (!info.nome || info.fail_reason) {
    return { fail_reason: info.fail_reason };
  }

  const new_cookies = await getCookies();

  store.dispatch(
    userInfoReducer.setState({
      name: info.nome,
      periodo: info.periodo,
      matricula,
      password: senha,
    }),
  );

  const { dictionary, failed } = getReqIds(homePageData);
  const new_dictionary = { ...dictionary, login: loginReqId };

  store.dispatch(
    apiConfigReducer.setState({
      cookies: new_cookies,
      dictionary: new_dictionary,
      _token,
    }),
  );

  if (failed > 20) {
    throw new Error('POSSIBLY_BLOCKED');
  } else {
    store.dispatch(apiConfigReducer.setIsBlocked(false));
  }

  return info;
}
