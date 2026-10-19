import { Platform } from 'react-native';

/** Telas que o aluno pode apontar no relato de problema. */
export const FEATURES = [
  'Login e Sessão',
  'Quadro de Horários',
  'Gerador de Grade',
  'Meu Progresso',
  'Plano até a formatura',
  'Mural de Mensagens',
  'Quadro de Notas',
  'RID Parcial',
  'Disciplinas do Currículo',
  'Disciplinas Universais',
  'Disciplinas Realizadas',
  'Pesquisa de Disciplinas',
  'Informações de uma disciplina específica',
  // os avisos só existem no Android
  ...(Platform.OS === 'android' ? ['Notificações'] : []),
  'Sobre',
];

/** Opção que pede o código da disciplina. */
export const SUBJECT_PAGE = 'Informações de uma disciplina específica';

export function isValidSubjectCode(code: string): boolean {
  return /^[A-Z][A-Z0-9]{1,7}-\d{3,8}$/.test(code.trim().toUpperCase());
}
