import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils/getRequisitionID';

import parseSubjectInfo from '@services/parser/parseSubjectInfo';

export const fetchSubjectInfo = async (subjectID?: string | number) => {
  const url = '/requisicaoaluno/requisicao.php';
  const requisicao = await getRequisitionID('DadosDisciplina');

  const options = {
    params: {
      controle: 'Aluno',
      requisicao,
      'disciplinas[0]': subjectID,
    },
  };
  const {data} = await api.get(url, options);

  return data as string;
};

export const getSubjectInfo = async (subjectID?: string | number) => {
  const data = await fetchSubjectInfo(subjectID);

  const subject = parseSubjectInfo(data);
  return subject;
};
