import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import iconv from 'iconv-lite';
import { Buffer } from 'buffer';

import store from '@root/store';
import { refreshAuth } from './lib/refreshAuth';
import { isSessionExpiredResponse } from './lib/isSessionExpiredResponse';
import { getRequisitionID, getRequisitionKey } from './utils/getRequisitionID';

const BASE_URL = 'https://www.alunoonline.uerj.br';

export type SessionRequestConfig = InternalAxiosRequestConfig & {
  _requisitionKey?: string;
  _sessionCreatedAt?: number;
  _sessionToken?: string;
  _sessionRetried?: boolean;
};

const api = axios.create({
  baseURL: BASE_URL,
  responseType: 'arraybuffer',
  withCredentials: true,
  timeout: 15_000,
  transformResponse: [
    res => (res ? iconv.decode(Buffer.from(res), 'iso-8859-1') : res),
  ],
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  },
});

api.interceptors.request.use(async (config: SessionRequestConfig) => {
  config._requisitionKey ??= getRequisitionKey(config.params?.requisicao);
  let { apiConfig } = store.getState();

  if (config._requisitionKey) {
    // Existing IDs and the token must come from one synchronous snapshot.
    // Only a missing derived ID requires I/O; reread after each await because
    // another login may have replaced the session while it was being fetched.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (apiConfig.dictionary[config._requisitionKey]) break;
      await getRequisitionID(config._requisitionKey, false);
      apiConfig = store.getState().apiConfig;
    }
    const requisicao = apiConfig.dictionary[config._requisitionKey];
    if (!requisicao) throw new Error('SESSION_EXPIRED');
    config.params = { ...config.params, requisicao };
  }

  config.params = { ...config.params, _token: apiConfig._token };
  config._sessionCreatedAt = apiConfig.createdAt;
  config._sessionToken = apiConfig._token;
  return config;
});

async function recoverSession(config: SessionRequestConfig) {
  if (config._sessionRetried) {
    throw new Error('SESSION_EXPIRED');
  }
  config._sessionRetried = true;

  const { apiConfig } = store.getState();
  const sessionAlreadyChanged =
    config._sessionCreatedAt !== apiConfig.createdAt ||
    config._sessionToken !== apiConfig._token;

  if (!sessionAlreadyChanged) {
    // refreshAuth shares one in-flight login. Let failures propagate so a
    // rejected login cannot become a successful, empty feature response.
    await refreshAuth();
  }

  if (!config._requisitionKey) {
    throw new Error('REQ_ID_NOT_FOUND');
  }

  return api(config);
}

api.interceptors.response.use(
  res => {
    if (isSessionExpiredResponse(res.data)) {
      return recoverSession(res.config);
    }
    return res;
  },
  (err: AxiosError) => {
    const status = err.response?.status;
    const mayBeExpired =
      status === 401 || status === 403 || status === 419 || status === 500;

    if (mayBeExpired && err.config) {
      return recoverSession(err.config);
    }

    return Promise.reject(err);
  },
);

export default api;
