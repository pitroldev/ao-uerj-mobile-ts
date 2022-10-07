import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils/getRequisitionID';

import parseCurriculumSubjects from '@services/parser/parseCurriculumSubjects';

export const fetchCurriculumSubjects = async () => {
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

export const getCurriculumSubjects = async () => {
  const data = await fetchCurriculumSubjects();

  const subjects = parseCurriculumSubjects(data);
  return subjects;
};
