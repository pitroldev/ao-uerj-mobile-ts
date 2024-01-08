import store from '@root/store';
import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils';

import parseData from './parser';

export const _fetchRawAttendedClassesScheduleData = async () => {
  const {apiConfig} = store.getState();
  const requisicao = await getRequisitionID('Disciplinas em Curso');

  const url = '/requisicaoaluno/';
  const {data} = await api.get(url, {
    params: {
      controle: 'Aluno',
      requisicao,
      _token: apiConfig._token,
    },
  });

  return data as string;
};

export async function fetchAttendedClassesSchedule() {
  const rawData = await _fetchRawAttendedClassesScheduleData();

  const data = parseData(rawData);
  return data;
}
