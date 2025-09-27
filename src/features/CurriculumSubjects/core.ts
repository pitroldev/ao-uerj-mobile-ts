import store from '@root/store';
import api from '@services/UerjApi';
import { getRequisitionID } from '@services/UerjApi/utils';

import parseData from './parser';

export const _fetchRawCurriculumSubjectsData = async () => {
  const url = '/requisicaoaluno/';
  const requisicao = await getRequisitionID('DisciplinasCursar');
  const { apiConfig } = store.getState();

  const options = {
    params: {
      controle: 'Aluno',
      _token: apiConfig._token,
      requisicao,
    },
  };

  const { data } = await api.get(url, options);

  return data as string;
};

export async function fetchCurriculumSubjects() {
  const rawData = await _fetchRawCurriculumSubjectsData();

  const data = parseData(rawData);

  return data;
}
