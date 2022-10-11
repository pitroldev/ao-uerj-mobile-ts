import store from '@root/store';

import api from '@services/UerjApi';
import {getRequisitionID, retry} from '@services/UerjApi/utils';

import parseData from './parser';
import * as reducer from './reducer';

export const _fetchRawUniversalSubjectsData = async (cod_unid?: string) => {
  const url = '/requisicaoaluno/requisicao.php';
  const requisicao = await getRequisitionID('Disciplinas Universais');

  const options = {
    params: {
      controle: 'Aluno',
      requisicao,
      cod_unid,
    },
  };

  const {data} = await api.get(url, options);

  return data as string;
};

export async function fetchUniversalSubjects(cod_unid?: string) {
  const rawData = await retry<string>(
    async () => await _fetchRawUniversalSubjectsData(cod_unid),
  );

  const data = parseData(rawData);

  store.dispatch(reducer.setSubjects(data.subjects));
  store.dispatch(reducer.setOptions(data.options));

  return data;
}
