import store from '@root/store';
import * as apiConfigReducer from '@reducers/apiConfig';

import api from '@services/UerjApi';
import parseSubjectInfoReqId from '@services/parser/subjectInfoReqId';

import { retry } from './retry';
import { refreshAuth } from '../lib/refreshAuth';
import type { SessionRequestConfig } from '../UerjApi';

// Retain a bounded mapping so IDs obtained just before a concurrent refresh
// can still be identified when Axios sends the request after that refresh.
const requisitionKeys = new Map<string, string>();

function rememberRequisition(key: string, reqId: string): string {
  requisitionKeys.set(reqId, key);
  if (requisitionKeys.size > 100) {
    const oldestKey = requisitionKeys.keys().next().value;
    if (oldestKey !== undefined) requisitionKeys.delete(oldestKey);
  }
  return reqId;
}

export function getRequisitionKey(reqId: unknown): string | undefined {
  if (typeof reqId !== 'string' || !reqId) return undefined;

  const { dictionary } = store.getState().apiConfig;
  return (
    Object.keys(dictionary).find(key => dictionary[key] === reqId) ??
    requisitionKeys.get(reqId)
  );
}

export async function getClassInfoReqIDs() {
  const requisicao = await getRequisitionID('DisciplinasCursar', false);
  const { apiConfig } = store.getState();

  const url = '/requisicaoaluno/';
  const { data, config } = await api.get(url, {
    params: {
      controle: 'Aluno',
      requisicao,
      _token: apiConfig._token,
    },
  });

  const reqIds = parseSubjectInfoReqId(data);

  if (!reqIds) {
    throw new Error('SUBJECT_REQ_ID_NOT_FOUND');
  }

  const sentSession = config as SessionRequestConfig;
  const currentSession = store.getState().apiConfig;
  if (
    sentSession._sessionCreatedAt !== currentSession.createdAt ||
    sentSession._sessionToken !== currentSession._token
  ) {
    throw new Error('SESSION_CHANGED');
  }
  // Validate and publish synchronously: a late response from an older login
  // must never add its derived ID to the current session's dictionary.
  store.dispatch(apiConfigReducer.addDictionary({ DadosDisciplina: reqIds }));
  return reqIds;
}

export async function getRequisitionID(
  key: string,
  refreshIfMissing = true,
): Promise<string> {
  const { dictionary } = store.getState().apiConfig;
  let reqId = dictionary[key];
  const needsMenu = key !== 'DadosDisciplina' || !dictionary.DisciplinasCursar;

  if (!reqId && needsMenu && refreshIfMissing) {
    await refreshAuth();
    reqId = store.getState().apiConfig.dictionary[key];
  }

  if (!reqId) {
    if (key === 'DadosDisciplina') {
      const newReqId = await retry(getClassInfoReqIDs);
      return rememberRequisition(key, newReqId);
    }

    throw new Error('REQ_ID_NOT_FOUND');
  }

  return rememberRequisition(key, reqId);
}
