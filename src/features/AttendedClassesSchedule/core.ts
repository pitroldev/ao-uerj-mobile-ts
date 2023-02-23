import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils';

import parseData from './parser';

export const _fetchRawAttendedClassesScheduleData = async () => {
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

export async function fetchAttendedClassesSchedule() {
  const rawData = await _fetchRawAttendedClassesScheduleData();

  const data = parseData(rawData);

  return data;
}
