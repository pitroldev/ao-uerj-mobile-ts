import store from '@root/store';

import api from '@services/UerjApi';
import {getRequisitionID, retry} from '@services/UerjApi/utils';

import isExpired from '@utils/isExpired';

import parseData from './parser';
import * as reducer from './reducer';

export const _fetchRawSubjectsTakenData = async () => {
  const url = '/requisicaoaluno/requisicao.php';
  const requisicao = await getRequisitionID('DisciplinasRealizadas');

  const options = {
    params: {
      controle: 'Aluno',
      requisicao,
    },
  };

  const {data} = await api.get(url, options);

  return data as string;
};

export async function fetchSubjectsTaken(useCache = true) {
  const {subjectsAttended} = store.getState();
  const isEmpty = subjectsAttended.data.length === 0;
  if (useCache && !isExpired(subjectsAttended?.lastUpdatedAt, 12) && !isEmpty) {
    return;
  }

  const rawData = await retry(_fetchRawSubjectsTakenData);

  const data = parseData(rawData);

  store.dispatch(reducer.setState(data));

  return data;
}
