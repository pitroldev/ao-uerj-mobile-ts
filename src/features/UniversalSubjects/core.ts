import store from '@root/store';

import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils';

import parseData from './parser';
import * as reducer from './reducer';

export const _fetchRawUniversalSubjectsData = async () => {
  const {apiConfig} = store.getState();
  const requisicao = await getRequisitionID('UniversaisCursar');

  const url = '/requisicaoaluno/';
  const {data} = await api.get(url, {
    params: {
      controle: 'Aluno',
      requisicao,
      _token: apiConfig._token,
    },
  });

  return data as string;
};

export async function fetchUniversalSubjects() {
  const rawData = await _fetchRawUniversalSubjectsData();

  const data = parseData(rawData);

  store.dispatch(reducer.setSubjects(data));

  return data;
}
