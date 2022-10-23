import api from '@services/PrivateApi';

import {Docente} from './types';

// FIXME Atualizar a desgraça do retorno do endpoint GET /docentes

export async function fetchTeacherList(): Promise<string[]> {
  const {data} = await api.get('/docentes');
  return data?.docentes ?? [];
}

export async function fetchTeacherDetails(name: string): Promise<Docente> {
  const {data} = await api.get(`/docentes/${name}`);
  const [docente] = data?.docentes ?? [];
  return docente ?? null;
}
