import type { IdeaArea, IssueStatus } from '@root/modules/ideas/domain/ideas';

/*
 * As sugestões da demo: os issues de sugestão "abertos" (para as parecidas e
 * para somar o pedido) e o que o aluno da demo já mandou. Tudo inventado; o
 * link de cada issue leva à lista de issues do repositório, nunca a um issue
 * de verdade com outro assunto.
 */

export const DEMO_ISSUES_URL =
  'https://github.com/pitroldev/ao-uerj-mobile-ts/issues';

export type DemoIssueSeed = {
  number: number;
  title: string;
  status: IssueStatus;
  requests: number;
};

/** Os issues de sugestão, os abertos e os já fechados. */
export const DEMO_ISSUES: readonly DemoIssueSeed[] = [
  {
    number: 31,
    title: 'Aviso de vaga nas turmas pedidas',
    status: 'planned',
    requests: 4,
  },
  {
    number: 24,
    title: 'Posição na fila do RID no Início',
    status: 'open',
    requests: 2,
  },
  {
    number: 28,
    title: 'Pontos de ônibus no Mapa',
    status: 'open',
    requests: 3,
  },
  {
    number: 35,
    title: 'Cardápio do bandejão no Início',
    status: 'in_progress',
    requests: 9,
  },
  {
    number: 21,
    title: 'Modo escuro no widget',
    status: 'done',
    requests: 6,
  },
];

export type DemoIdeaSeed = {
  kind: 'sent' | 'joined';
  title: string;
  area: IdeaArea | null;
  /** Há quantos dias foi mandada. */
  daysAgo: number;
  /** O issue dela; sem ele, ainda esperando a moderação. */
  issue: number | null;
};

/** O que o aluno da demo já mandou ou somou, do mais novo ao mais antigo. */
export const DEMO_IDEAS: readonly DemoIdeaSeed[] = [
  {
    kind: 'sent',
    title: 'Lembrete da PF no dia anterior',
    area: 'grades',
    daysAgo: 1,
    issue: null,
  },
  { kind: 'joined', title: '', area: null, daysAgo: 6, issue: 31 },
  {
    kind: 'sent',
    title: 'Pontos de ônibus no Mapa',
    area: 'map',
    daysAgo: 12,
    issue: 28,
  },
  {
    kind: 'sent',
    title: 'Modo escuro no widget',
    area: 'home',
    daysAgo: 40,
    issue: 21,
  },
];
