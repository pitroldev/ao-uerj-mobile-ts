import store from '@root/store';

import api from '@services/UerjApi';

import isExpired from '@utils/isExpired';

import parseData from './parser';
import * as reducer from './reducer';

export const _fetchRawClassGradesData = async () => {
  const url = '/notasdoperiododoaluno/notasparciais.php';

  const {data} = await api.get(url);

  return data as string;
};

export async function fetchClassGrades() {
  const {classGrades} = store.getState();
  if (!isExpired(classGrades?.lastUpdatedAt, 6)) {
    return;
  }

  const rawData = await _fetchRawClassGradesData();

  const data = parseData(rawData);

  store.dispatch(reducer.setClassGrades(data));

  return data;
}
