import store from '@root/store';
import api from '@services/UerjApi';
import {getRequisitionID} from '@services/UerjApi/utils';

import parseSubjectInfo from './parser';

export const _fetchRawSubjectInfoData = async (subjectID?: string | number) => {
  const url = '/requisicaoaluno/requisicao.php';
  const requisicao = await getRequisitionID('DadosDisciplina');
  const {apiConfig} = store.getState();

  const options = {
    params: {
      controle: 'Aluno',
      requisicao,
      _token: apiConfig._token,
      'disciplinas[0]': subjectID,
    },
  };
  const {data} = await api.get(url, options);

  return data as string;
};

export const getSubjectInfo = async (subjectID?: string | number) => {
  const data = await _fetchRawSubjectInfoData(subjectID);

  const subject = parseSubjectInfo(data);
  return subject;
};
