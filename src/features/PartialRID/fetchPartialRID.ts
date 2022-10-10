import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils';

import parseData from './parser';

export const _fetchRawPartialRIDData = async () => {
  const url = '/requisicaoaluno/requisicao.php';
  const requisicao = await getRequisitionID('RidParcial');

  const options = {
    params: {
      controle: 'Rid',
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
