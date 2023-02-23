import api from '@services/UerjApi';

import parseData from './parser';

export const _fetchRawClassGradesData = async () => {
  const url = '/notasdoperiododoaluno/notasparciais.php';

  const {data} = await api.get(url);

  return data as string;
};

export async function fetchClassGrades() {
  const rawData = await _fetchRawClassGradesData();

  const data = parseData(rawData);

  return data;
}
