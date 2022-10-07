import store from '@root/store';
import * as apiConfigReducer from '@reducers/apiConfig';

import api from '@services/UerjApi';
import parseSubjectInfoReqId from '@services/parser/subjectInfoReqId';

import {retry} from './retry';

export async function getClassInfoReqIDs() {
  const url = '/requisicaoaluno/requisicao.php';
  const requisicao = await getRequisitionID('DisciplinasCursar');
  const options = {
    params: {
      controle: 'Aluno',
      requisicao,
    },
  };
  const {data} = await api.get(url, options);

  const reqIds = await parseSubjectInfoReqId(data);
  return reqIds;
}

export async function getRequisitionID(key: string): Promise<string> {
  // TODO: string similarity > 0.8
  const {apiConfig} = store.getState();
  const reqId = apiConfig.dictionary[key];

  if (!reqId) {
    if (key === 'DadosDisciplina' || key === 'HorariosTurmasDisciplina') {
      const reqIds = await retry<ReturnType<typeof getClassInfoReqIDs>>(
        getClassInfoReqIDs,
      );
      store.dispatch(apiConfigReducer.addDictionary(reqIds));
      return reqIds[key];
    }
    throw new Error('REQ_ID_NOT_FOUND');
  }

  return reqId;
}
