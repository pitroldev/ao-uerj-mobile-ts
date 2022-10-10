import store from '@root/store';

import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils';

import isExpired from '@utils/isExpired';

import parseData from './parser';
import * as reducer from './reducer';

export const _fetchRawSubjectsToTakeData = async () => {
  const url = '/requisicaoaluno/requisicao.php';
  const requisicao = await getRequisitionID('DisciplinasCursar');

  const options = {
    params: {
      controle: 'Aluno',
      requisicao,
    },
  };

  const {data} = await api.get(url, options);

  return data as string;
};

export async function fetchSubjectsToTake() {
  const {subjectsToTake} = store.getState();
  const isEmpty = subjectsToTake.data.length === 0;
  if (!isExpired(subjectsToTake?.lastUpdatedAt, 12) && !isEmpty) {
    return;
  }

  const rawData = await _fetchRawSubjectsToTakeData();

  const data = parseData(rawData);
  store.dispatch(reducer.setState(data));

  return data;
}