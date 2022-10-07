import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils/getRequisitionID';

import ridProvisorio from '@services/parser/ridProvisorio';

export const fetchPartialRID = async () => {
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

export const getPartialRID = async () => {
  const data = await fetchPartialRID();

  const rid = ridProvisorio(data);

  return rid;
};
