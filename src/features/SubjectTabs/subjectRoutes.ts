/**
 * As três telas de disciplinas do Aluno Online, que o app mostra como uma só,
 * "Disciplinas", com abas: cada aba continua sendo a sua rota (o aviso remoto,
 * o relato de erro e a volta de "Informações da Disciplina" seguem por ela).
 */
export const SUBJECT_ROUTES = [
  'Disciplinas Realizadas',
  'Disciplinas do Currículo',
  'Disciplinas Universais',
] as const;

export type SubjectRoute = (typeof SUBJECT_ROUTES)[number];

/** O nome da tela no cabeçalho e no menu. */
export const SUBJECTS_TITLE = 'Disciplinas';

/** O rótulo de cada aba. */
export const SUBJECT_TAB_LABEL: Readonly<Record<SubjectRoute, string>> = {
  'Disciplinas Realizadas': 'Realizadas',
  'Disciplinas do Currículo': 'Do currículo',
  'Disciplinas Universais': 'Universais',
};

export const isSubjectRoute = (route: string): route is SubjectRoute =>
  (SUBJECT_ROUTES as readonly string[]).includes(route);

let lastRoute: SubjectRoute = SUBJECT_ROUTES[0];

/** A última aba aberta, para "Disciplinas" no menu voltar a ela. */
export const lastSubjectRoute = (): SubjectRoute => lastRoute;

export function rememberSubjectRoute(route: SubjectRoute): void {
  lastRoute = route;
}
