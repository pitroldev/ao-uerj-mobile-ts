import api from '@services/UerjApi';
import {getRequisitionID, retry} from '@services/UerjApi/utils';

import parseSubjectInfo from './parser';

export const _fetchRawSubjectInfoData = async (subjectID?: string | number) => {
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
  const data = await retry<string>(
    async () => await _fetchRawSubjectInfoData(subjectID),
  );

  const subject = parseSubjectInfo(data);
  return subject;
};
