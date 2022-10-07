import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils/getRequisitionID';

import parseSubjectClassesSchedule from '@services/parser/parseSubjectClassesSchedule';

export const fetchSubjectClassesSchedule = async (
  subjectID?: string | number,
) => {
  const url = '/requisicaoaluno/requisicao.php';
  const requisicao = await getRequisitionID('HorariosTurmasDisciplina');

  const options = {
    params: {
      controle: 'Aluno',
      requisicao,
      'disciplinas[0]': subjectID,
    },
  };
  const {data} = await api.get(url, options);

  return data as string;
};

export const getSubjectClassesSchedule = async (
  subjectID?: string | number,
) => {
  const data = await fetchSubjectClassesSchedule(subjectID);

  const schedule = parseSubjectClassesSchedule(data);
  return schedule;
};
