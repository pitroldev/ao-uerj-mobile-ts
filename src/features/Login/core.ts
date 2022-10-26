import api from '@services/UerjApi';
import {retry} from '@services/UerjApi/utils';
import {clearAllCookies, getCookies} from '@services/cookies';

import store from '@root/store';
import * as apiConfigReducer from '@reducers/apiConfig';
import * as userInfoReducer from '@reducers/userInfo';

import parseLoginReqId from './parseLoginReqId';
import parseLoginInfo from './parseLoginData';
import {getReqIds} from './parseReqIds';

export async function fetchLoginPage(): Promise<string> {
  const url = '/requisicaoaluno/requisicao.php';
  const options = {
    params: {
      requisicao: 'LoginAlunoOnline',
    },
  };
  const {data} = await api.get(url, options);

  return data as string;
}

export async function handleLogin(matricula: string, senha: string) {
  await clearAllCookies();

  const url = '/requisicaoaluno/requisicaoacesso.php';
  const loginPageData = await retry(fetchLoginPage);
  const loginReqId = await parseLoginReqId(loginPageData);

  const {data: homePageData} = await retry(
    async () =>
      await api.get(url, {
        params: {
          controle: 'Login',
          requisicao: loginReqId,
          matricula,
          senha,
        },
      }),
  );

  const info = parseLoginInfo(homePageData);
  const new_cookies = await getCookies();

  if (info.fail_reason) {
    return info;
  }

  store.dispatch(
    userInfoReducer.setState({
      name: info.nome,
      periodo: info.periodo,
      matricula,
      password: senha,
    }),
  );

  const reqIds = getReqIds(homePageData);
  const new_dictionary = {...reqIds, login: loginReqId};

  store.dispatch(
    apiConfigReducer.setState({
      cookies: new_cookies,
      dictionary: new_dictionary,
    }),
  );

  return info;
}
