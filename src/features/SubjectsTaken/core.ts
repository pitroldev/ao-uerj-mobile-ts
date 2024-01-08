import store from '@root/store';
import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils';

import parseData from './parser';

export const _fetchRawSubjectsTakenData = async () => {
  const url = '/requisicaoaluno/';
  const requisicao = await getRequisitionID('DisciplinasRealizadas');
  const {apiConfig} = store.getState();

  const options = {
    params: {
      controle: 'Aluno',
      requisicao,
      _token: apiConfig._token,
    },
  };

  const {data} = await api.get(url, options);

  return data as string;
};

export async function fetchSubjectsTaken() {
  const rawData = await _fetchRawSubjectsTakenData();

  const data = parseData(rawData);

  return data;
}
