import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils/getRequisitionID';

import parseAttendedSubjects from '@services/parser/parseAttendedSubjects';

export const fetchAttendedSubjects = async () => {
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

export const getAttendedSubjects = async () => {
  const data = await fetchAttendedSubjects();

  const subjects = parseAttendedSubjects(data);
  return subjects;
};
