import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils/getRequisitionID';

import parseUniversalSubjects from '@services/parser/parseUniversalSubjects';

export const fetchUniversalSubjects = async (cod_unid?: string) => {
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

export const getUniversalSubjects = async (cod_unid?: string) => {
  const data = await fetchUniversalSubjects(cod_unid);

  const subjects = parseUniversalSubjects(data);
  return subjects;
};
