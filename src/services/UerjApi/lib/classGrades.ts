import api from '@services/UerjApi';
import notasParciais from '@services/parser/notasParciais';

export const fetchClassGrades = async () => {
  const url = '/notasdoperiododoaluno/notasparciais.php';

  const {data} = await api.get(url);

  return data as string;
};

export const getClassGrades = async () => {
  const data = await fetchClassGrades();

  const grades = notasParciais(data);
  return grades;
};
