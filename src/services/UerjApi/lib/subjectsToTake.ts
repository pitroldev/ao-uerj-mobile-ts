import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils/getRequisitionID';

import parseSubjectsToTake from '@services/parser/parseSubjectsToTake';

export const fetchSubjectsToTake = async () => {
  const url = '/requisicaoaluno/requisicao.php';
  const requisicao = await getRequisitionID('DisciplinasCursar');

  const options = {
    params: {
      controle: 'Aluno',
      requisicao,
    },
  };

  const {data} = await api.get(url, options);

  return data as string;
};

export const getSubjectsToTake = async () => {
  const data = await fetchSubjectsToTake();

  const subjects = parseSubjectsToTake(data);
  return subjects;
};
