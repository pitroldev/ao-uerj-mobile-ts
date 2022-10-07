import axios from 'axios';
import iconv from 'iconv-lite';
import {Buffer} from 'buffer';

import store from '@root/store';
import moment from 'moment';
import {refreshAuth} from './lib/refreshAuth';

const BASE_URL = 'https://www.alunoonline.uerj.br';
const COOKIE_MAX_DURATION_IN_HOURS = 23;

const api = axios.create({
  baseURL: BASE_URL,
  responseType: 'arraybuffer',
  withCredentials: true,
  transformResponse: [
    res => (res ? iconv.decode(Buffer.from(res), 'iso-8859-1') : res),
  ],
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  },
});

axios.interceptors.request.use(async function (config) {
  const {apiConfig} = store.getState();

  const now = moment();
  const cookieCreationDate = moment(apiConfig.createdAt);
  const cookieTimeInHours = now.diff(cookieCreationDate, 'hours');

  if (cookieTimeInHours > COOKIE_MAX_DURATION_IN_HOURS) {
    refreshAuth;
  }

  return config;
});

api.interceptors.response.use(
  response => {
    const params = response.config?.params;
    const isLogin =
      params?.controle === 'Login' || params?.requisicao === 'LoginAlunoOnline';

    const isLoginPage = response.data.includes(
      'name="controle"  value="Login"',
    );
    if (!isLogin && isLoginPage) {
      throw new Error('NOT_LOGGED_IN');
    }

    return response;
  },
  error => error,
);

export default api;
