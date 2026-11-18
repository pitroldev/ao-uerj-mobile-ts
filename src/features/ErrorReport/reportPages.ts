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
  'Notificações',
  'Sobre',
];

/** Opção que pede o código da disciplina. */
export const SUBJECT_PAGE = 'Informações de uma disciplina específica';

/** Opção que leva junto as contagens da última tentativa no gerador. */
export const GENERATOR_PAGE = 'Gerador de Grade';

/**
 * As leituras do portal de cada tela, cuja página vai junto no relato,
 * anonimizada. As telas sem página do portal (o mural, o gerador, o login)
 * ficam de fora.
 */
const PAGE_READS: Record<string, string[]> = {
  'Quadro de Horários': ['schedule'],
  'Quadro de Notas': ['grades'],
  'RID Parcial': ['partial-rid'],
  'Disciplinas do Currículo': ['curriculum'],
  'Disciplinas Universais': ['universal-subjects'],
  'Disciplinas Realizadas': ['history'],
  'Meu Progresso': ['history', 'synthesis'],
  'Plano até a formatura': ['synthesis', 'curriculum'],
  [SUBJECT_PAGE]: ['subject-details'],
};

/** As páginas da tela escolhida e as das leituras que estão com erro, até três. */
export function portalPageReads(
  page: string,
  failing: readonly string[] = [],
): string[] {
  return [...new Set([...(PAGE_READS[page] ?? []), ...failing])].slice(0, 3);
}

export function isValidSubjectCode(code: string): boolean {
  return /^[A-Z][A-Z0-9]{1,7}-\d{3,8}$/.test(code.trim().toUpperCase());
}
