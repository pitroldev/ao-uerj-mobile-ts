import axios, {AxiosError, AxiosResponse} from 'axios';
import iconv from 'iconv-lite';
import {Buffer} from 'buffer';

import store from '@root/store';
import moment from 'moment';
import {refreshAuth} from './lib/refreshAuth';
import {NOT_RETRY_ERRORS} from './utils';

const BASE_URL = 'https://www.alunoonline.uerj.br';
const COOKIE_MAX_DURATION_IN_HOURS = 2;
const MAX_ERROR_RETRIES = 3;
const MAX_SUCCESS_RETRIES = 1;

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

  console.log('[ERROR INTERCEPTOR]', err);

  if (!userInfo.matricula || !userInfo.password) {
    throw new Error('NOT_LOGGED_IN');
  }

  const isServerError = err?.response?.status && err.response.status >= 500;
  const originalRequest = err.config as any;

  const isReachedRetryLimit = originalRequest._retries >= MAX_ERROR_RETRIES;

  const isSessionPossiblyExpired =
    cookieTimeInHours > COOKIE_MAX_DURATION_IN_HOURS || isServerError;

  const isNotRetryError = NOT_RETRY_ERRORS.includes(err.message);

  if (isSessionPossiblyExpired && !isReachedRetryLimit && !isNotRetryError) {
    originalRequest._retries = (originalRequest._retries || 0) + 1;

    await refreshAuth().catch(e => {
      const notRetry = NOT_RETRY_ERRORS.includes(e.message);
      if (notRetry) {
        originalRequest._retries = MAX_ERROR_RETRIES;
      }
    });

    return api(originalRequest);
  }

  Promise.reject(err);
};

const responseSuccessInterceptor = async (res: AxiosResponse) => {
  const dataLen = res?.data?.length || 0;
  const hasNoData = dataLen === 0 || dataLen < 100;

  const originalRequest = res.config as any;
  const isReachedRetryLimit = originalRequest._retries >= MAX_SUCCESS_RETRIES;

  if (hasNoData && !isReachedRetryLimit) {
    originalRequest._retries = (originalRequest._retries || 0) + 1;

    await refreshAuth().catch(e => {
      const notRetry = NOT_RETRY_ERRORS.includes(e.message);
      if (notRetry) {
        originalRequest._retries = MAX_SUCCESS_RETRIES;
      }
    });

    return api(originalRequest);
  }

  return res;
};

api.interceptors.response.use(
  responseSuccessInterceptor,
  responseErrorInterceptor,
);

export default api;
