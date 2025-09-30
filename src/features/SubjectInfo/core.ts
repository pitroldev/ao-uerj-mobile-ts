import store from '@root/store';
import api from '@services/UerjApi';
import { getRequisitionID } from '@services/UerjApi/utils';

import parseSubjectInfo from './parser';

export const _fetchRawSubjectInfoData = async (subjectID?: string | number) => {
  const url = '/requisicaoaluno/';
  const requisicao = await getRequisitionID('DadosDisciplina');
  const { apiConfig } = store.getState();

  const options = {
    params: {
      controle: 'Aluno',
      requisicao,
      _token: apiConfig._token,
      'disciplinas[0]': subjectID,
    },
  };
  const { data } = await api.get(url, options);

  return data as string;
};

export const getSubjectInfo = async (subjectID?: string | number) => {
  try {
    const data = await _fetchRawSubjectInfoData(subjectID);
    if (!data || typeof data !== 'string') {
      throw new Error('INVALID_API_RESPONSE');
    }

    const subject = parseSubjectInfo(data);
    if (!subject || !subject.id) {
      throw new Error('SUBJECT_PARSE_FAILED');
    }

    return subject;
  } catch (error) {
    if (__DEV__) {
      console.error('[getSubjectInfo] Error details:', {
        subjectID,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('UNKNOWN_SUBJECT_INFO_ERROR');
    }
  }
};
