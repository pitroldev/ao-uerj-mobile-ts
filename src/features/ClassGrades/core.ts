import api from '@services/UerjApi';
import store from '@root/store';
import {getRequisitionID} from '@services/UerjApi/utils';

import parseData from './parser';

export const _fetchRawClassGradesData = async () => {
  const url = '/requisicaoaluno/';
  const {apiConfig} = store.getState();
  const requisicao = await getRequisitionID('notas');

  const {data} = await api.get(url, {
    params: {
      controle: 'Aluno',
      requisicao,
      _token: apiConfig._token,
    },
  });

  return data as string;
};

export async function fetchClassGrades() {
  const rawData = await _fetchRawClassGradesData();

  const data = parseData(rawData);

  return data;
}
