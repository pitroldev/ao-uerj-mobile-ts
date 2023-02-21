import api from '@services/UerjApi';
import {getRequisitionID, retry} from '@services/UerjApi/utils';

import parseData from './parser';

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
  const rawData = await retry(_fetchRawCurriculumSubjectsData);

  const data = parseData(rawData);

  return data;
}
