import store from '@root/store';

import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils';

import parseData from './parser';
import * as reducer from './reducer';

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
  const {data} = await api.get(url, options);

  return data as string;
};

export async function fetchClassesScheduleByDepartment(code_unid?: string) {
  const rawData = await _fetchRawClassesScheduleByUnitData(code_unid);

  const data = parseData(rawData);

  store.dispatch(reducer.setSubjects(data.subjects));
  store.dispatch(reducer.setOptions(data.options));

  return data;
}