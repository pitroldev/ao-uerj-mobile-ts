import store from '@root/store';

import api from '@services/UerjApi';
import {getRequisitionID, retry} from '@services/UerjApi/utils';

import isExpired from '@utils/isExpired';

import * as attendedReducer from './reducer';

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
  const {userInfo, attendedClasses} = store.getState();

  const isEmpty =
    attendedClasses?.data[userInfo.periodo as string]?.length === 0;

  if (!isExpired(attendedClasses?.lastUpdatedAt, 12) && !isEmpty) {
    return;
  }

  const rawData = await retry<string>(_fetchRawAttendedClassesScheduleData);

  const data = parseData(rawData);

  store.dispatch(
    attendedReducer.setAttendedClasses({
      period: userInfo.periodo as string,
      data,
    }),
  );

  return data;
}
