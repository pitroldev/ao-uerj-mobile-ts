import api from '@services/UerjApi';
import {getRequisitionID, retry} from '@services/UerjApi/utils';

import parseSubjectClassesSchedule from './parser';

export const _fetchRawSubjectClassesScheduleData = async (
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
  const data = await retry(
    async () => await _fetchRawSubjectClassesScheduleData(subjectID),
  );

  const schedule = parseSubjectClassesSchedule(data);
  return schedule;
};