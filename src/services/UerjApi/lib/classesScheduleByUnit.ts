import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils/getRequisitionID';

import parseClassesScheduleByUnit from '@root/services/parser/parseClassesScheduleByUnit';

export const fetchClassesScheduleByUnit = async (code_unid?: string) => {
  const url = '/requisicaoaluno/requisicao.php';
  const requisicao = await getRequisitionID('Horário das Turmas');

  const options = {
    params: {
      controle: 'Aluno',
      requisicao,
      idUnidadeSelecionadaHorariosTurmas: code_unid,
    },
  };
  const {data} = await api.get(url, options);

  return data as string;
};

export const getClassesScheduleByUnit = async (code_unid?: string) => {
  const data = await fetchClassesScheduleByUnit(code_unid);

  const schedule = parseClassesScheduleByUnit(data);
  return schedule;
};
