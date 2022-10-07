import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils/getRequisitionID';

import parseAttendedClassesSchedule from '@services/parser/attendedClassSchedules';

export const fetchAttendedClassesSchedule = async () => {
  const url = '/requisicaoaluno/requisicao.php';
  const requisicao = await getRequisitionID('DisciplinasCurso');

  const options = {
    params: {
      controle: 'Aluno',
      requisicao,
    },
  };
  const {data} = await api.get(url, options);

  return data as string;
};

export const getAttendedClassesSchedule = async () => {
  const data = await fetchAttendedClassesSchedule();

  const schedule = parseAttendedClassesSchedule(data);
  return schedule;
};
