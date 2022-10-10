import store from '@root/store';

import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils';

import isExpired from '@utils/isExpired';

import parseData from './parser';
import * as reducer from './reducer';

export const _fetchRawCurriculumSubjectsData = async () => {
  const url = '/requisicaoaluno/requisicao.php';
  const requisicao = await getRequisitionID('DisciplinasFormacao');

  const options = {
    params: {
      controle: 'Aluno',
      requisicao,
    },
  };

  const {data} = await api.get(url, options);

  return data as string;
};

export async function fetchCurriculumSubjects() {
  const {curriculumSubjects} = store.getState();

  const isEmpty = curriculumSubjects.data.length === 0;
  if (!isEmpty && !isExpired(curriculumSubjects?.lastUpdatedAt, 12)) {
    return;
  }

  const rawData = await _fetchRawCurriculumSubjectsData();

  const data = parseData(rawData);

  store.dispatch(reducer.setState(data));

  return data;
}
