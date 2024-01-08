import store from '@root/store';
import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils';

import parseSubjectClassesSchedule from './parser';

export const _fetchRawSubjectClassesScheduleData = async (
  subjectID?: string | number,
) => {
  const url = '/requisicaoaluno/';
  const requisicao = await getRequisitionID('HorariosTurmasDisciplina');
  const {apiConfig} = store.getState();

  const options = {
    params: {
      controle: 'Aluno',
      requisicao,
      _token: apiConfig._token,
      'disciplinas[0]': subjectID,
    },
  };
  const {data} = await api.get(url, options);

  return data as string;
};

export const getSubjectClassesSchedule = async (
  subjectID?: string | number,
) => {
  const data = await _fetchRawSubjectClassesScheduleData(subjectID);

  const schedule = parseSubjectClassesSchedule(data);
  return schedule;
};
