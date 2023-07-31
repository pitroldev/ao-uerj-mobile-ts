import store from '@root/store';
import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils';

import parseData from './parser';

export const _fetchRawSubjectsToTakeData = async () => {
  const url = '/requisicaoaluno/requisicao.php';
  const requisicao = await getRequisitionID('DisciplinasCursar');
  const {apiConfig} = store.getState();

  const options = {
    params: {
      controle: 'Aluno',
      requisicao,
      _token: apiConfig._token,
    },
  };

  const {data} = await api.get(url, options);

  return data as string;
};

export async function fetchSubjectsToTake() {
  const rawData = await _fetchRawSubjectsToTakeData();

  const data = parseData(rawData);

  return data;
}
