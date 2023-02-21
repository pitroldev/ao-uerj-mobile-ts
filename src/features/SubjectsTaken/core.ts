import api from '@services/UerjApi';
import {getRequisitionID, retry} from '@services/UerjApi/utils';

import parseData from './parser';

export const _fetchRawSubjectsTakenData = async () => {
  const url = '/requisicaoaluno/requisicao.php';
  const requisicao = await getRequisitionID('DisciplinasRealizadas');

  const options = {
    params: {
      controle: 'Aluno',
      requisicao,
    },
  };

  const {data} = await api.get(url, options);

  return data as string;
};

export async function fetchSubjectsTaken() {
  const rawData = await retry(_fetchRawSubjectsTakenData);

  const data = parseData(rawData);

  return data;
}
