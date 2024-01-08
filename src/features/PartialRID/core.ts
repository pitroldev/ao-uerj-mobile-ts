import store from '@root/store';
import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils';

import parseData from './parser';

export const _fetchRawPartialRIDData = async () => {
  const url = '/requisicaoaluno/';
  const requisicao = await getRequisitionID('RidParcial');
  const {apiConfig} = store.getState();

  const options = {
    params: {
      controle: 'Rid',
      _token: apiConfig._token,
      requisicao,
    },
  };

  const {data} = await api.get(url, options);

  return data as string;
};

export async function fetchPartialRID() {
  const rawData = await _fetchRawPartialRIDData();

  const data = parseData(rawData);

  return data;
}
