import store from '@root/store';

import api from '@services/PrivateApi';

import {ChatMessage} from './types';

export async function fetchMessages(
  subjectId: string,
  classNumber: string | number,
) {
  const {userInfo} = store.getState();

  const {data} = await api.post('/messages/get', {
    disciplina: subjectId,
    turma: classNumber,
    periodo: userInfo.periodo,
  });

  return data as ChatMessage[];
}

export async function postMessage(body: any) {
  const {data} = await api.post('/messages/post', body);
  return data;
}
