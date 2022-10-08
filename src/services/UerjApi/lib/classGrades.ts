import api from '@services/UerjApi';
import {parseClassGrades} from '@services/parser';

export const fetchClassGrades = async () => {
  const url = '/notasdoperiododoaluno/notasparciais.php';

  const {data} = await api.get(url);

  return data as string;
};

export const getClassGrades = async () => {
  const data = await fetchClassGrades();

  const grades = parseClassGrades(data);
  return grades;
};
