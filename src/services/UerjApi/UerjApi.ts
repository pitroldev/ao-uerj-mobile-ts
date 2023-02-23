import axios, {AxiosError} from 'axios';
import iconv from 'iconv-lite';
import {Buffer} from 'buffer';

import store from '@root/store';
import moment from 'moment';
import {refreshAuth} from './lib/refreshAuth';

const BASE_URL = 'https://www.alunoonline.uerj.br';
const COOKIE_MAX_DURATION_IN_HOURS = 2;

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

const responseErrorInterceptor = async (err: AxiosError) => {
  const {apiConfig, userInfo} = store.getState();

  const now = moment();
  const cookieCreationDate = moment(apiConfig.createdAt);
  const cookieTimeInHours = now.diff(cookieCreationDate, 'hours');

  if (!userInfo.matricula || !userInfo.password) {
    throw new Error('NOT_LOGGED_IN');
  }

  const isServerError = err?.response?.status && err.response.status >= 500;
  const originalRequest = err.config as any;

  const isReachedRetryLimit =
    !originalRequest._retries || originalRequest._retries >= 3;

  const isSessionPossiblyExpired =
    cookieTimeInHours > COOKIE_MAX_DURATION_IN_HOURS || isServerError;

  if (isSessionPossiblyExpired && !isReachedRetryLimit) {
    originalRequest._retries = (originalRequest._retries || 0) + 1;

    await refreshAuth();

    return api(originalRequest);
  }

  Promise.reject(err);
};

api.interceptors.response.use(undefined, responseErrorInterceptor);

export default api;
