import store from '@root/store';
import * as apiConfigReducer from '@reducers/apiConfig';

import api from '@services/UerjApi';
import parseSubjectInfoReqId from '@services/parser/subjectInfoReqId';

import { retry } from './retry';

export async function getClassInfoReqIDs() {
  const requisicao = await getRequisitionID('DisciplinasCursar');
  const { apiConfig } = store.getState();

  const url = '/requisicaoaluno/';
  const { data } = await api.get(url, {
    params: {
      controle: 'Aluno',
      requisicao,
      _token: apiConfig._token,
    },
  });

  const reqIds = parseSubjectInfoReqId(data);

  return reqIds;
}

export async function getRequisitionID(key: string): Promise<string> {
  // TODO: string similarity > 0.8
  const { apiConfig } = store.getState();
  const reqId = apiConfig.dictionary[key];

  if (!reqId) {
    if (key === 'DadosDisciplina') {
      const newReqId = await retry(getClassInfoReqIDs);
      store.dispatch(
        apiConfigReducer.addDictionary({
          DadosDisciplina: newReqId,
        }),
      );
      return newReqId;
    }

    throw new Error('REQ_ID_NOT_FOUND');
  }

  return reqId;
}
