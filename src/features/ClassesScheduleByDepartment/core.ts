import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils';

import parseData from './parser';

export const _fetchRawClassesScheduleByUnitData = async (
  code_unid?: string,
) => {
  const url = '/requisicaoaluno/requisicao.php';
  const requisicao = await getRequisitionID('Horário das Turmas');

  const options = {
    params: {
      controle: 'Aluno',
      requisicao,
      idUnidadeSelecionadaHorariosTurmas: code_unid,
    },
  };
  const res = await api.get(url, options);

  return res.data as string;
};

export async function fetchClassesScheduleByDepartment(code_unid?: string) {
  const rawData = await _fetchRawClassesScheduleByUnitData(code_unid);

  const data = parseData(rawData);

  return data;
}
