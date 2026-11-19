import { hasContact } from '@root/modules/companion/domain/companion';

/*
 * "Sugerir uma ideia": o aluno manda a ideia pelo app, a moderação olha e a
 * publica como issue no GitHub (público, sem nada de quem mandou), e o estado
 * do issue volta para "Minhas sugestões". As listas e os limites são os do
 * servidor (server/src/modules/ideas/domain.ts).
 */

/** Onde no app a ideia mexe. */
export const IDEA_AREAS = [
  'home',
  'schedule',
  'grades',
  'rid',
  'subjects',
  'generator',
  'companion',
  'campus',
  'map',
  'mural',
  'other',
] as const;
export type IdeaArea = (typeof IDEA_AREAS)[number];

/** "O Aluno Online já faz isso?" */
export const PORTAL_ANSWERS = ['yes_bad', 'no', 'unknown'] as const;
export type PortalAnswer = (typeof PORTAL_ANSWERS)[number];

export type IdeaPlatform = 'android' | 'ios';

/**
 * `received`: esperando a moderação; `not_published`: ela não publicou;
 * `open`: no GitHub; `planned` e `in_progress`: as etiquetas do issue;
 * `done`: fechado como feito; `closed`: fechado sem fazer.
 */
export const IDEA_STATUSES = [
  'received',
  'not_published',
  'open',
  'planned',
  'in_progress',
  'done',
  'closed',
] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

/** O estado de um issue do GitHub (as parecidas já estão publicadas). */
export type IssueStatus = Exclude<IdeaStatus, 'received' | 'not_published'>;
export const ISSUE_STATUSES: readonly IssueStatus[] = [
  'open',
  'planned',
  'in_progress',
  'done',
  'closed',
];

export const IDEA_LIMITS = {
  title: { min: 4, max: 80 },
  problem: { min: 10, max: 1000 },
  idea: { max: 1000 },
  /** As parecidas que o app mostrou e o aluno seguiu mesmo assim. */
  seenSimilar: 5,
  /** Por aluno, por dia de São Paulo. */
  perDay: 3,
} as const;

/** Uma sugestão do aluno: a que ele mandou (`sent`) ou o pedido que somou (`joined`). */
export type MyIdea = {
  id: string;
  kind: 'sent' | 'joined';
  title: string;
  /** `null` nos pedidos somados. */
  area: IdeaArea | null;
  createdAt: number;
  status: IdeaStatus;
  issue: { number: number; url: string } | null;
  /** Quantos pediram: os alunos pelo app e os 👍 no GitHub. */
  requests: number;
};

export type MyIdeas = {
  /** As mais novas primeiro. */
  ideas: MyIdea[];
  /** Quantas o aluno ainda pode mandar hoje. */
  remainingToday: number;
};

/** Um issue aberto parecido com o que o aluno escreveu. */
export type SimilarIdea = {
  number: number;
  title: string;
  url: string;
  status: IssueStatus;
  requests: number;
};

/** O que o aluno escreve na folha. */
export type IdeaDraft = {
  title: string;
  area: IdeaArea | null;
  problem: string;
  /** "Como você imagina", opcional. */
  idea: string;
  portal: PortalAnswer;
};

/** O pedido ao servidor, com o texto já arrumado. */
export type NewIdea = {
  title: string;
  area: IdeaArea;
  problem: string;
  idea?: string;
  portal: PortalAnswer;
  appVersion: string;
  platform: IdeaPlatform;
  seenSimilar: number[];
};

/** Os campos de texto da folha, na ordem dela. */
export const IDEA_FIELDS = ['title', 'problem', 'idea'] as const;
export type IdeaField = (typeof IDEA_FIELDS)[number];

/**
 * As recusas do servidor que o app explica: contato num campo (`contact`,
 * com o campo quando o servidor diz), três no dia (`limit`), o issue fechou
 * (`gone`) e o GitHub fora (ou ainda não ligado no servidor: `github`).
 */
export type IdeaRefusal = 'contact' | 'limit' | 'gone' | 'github';

export class IdeaError extends Error {
  constructor(
    readonly refusal: IdeaRefusal,
    readonly field: IdeaField | null = null,
  ) {
    super(field ? `${refusal}: ${field}` : refusal);
    this.name = 'IdeaError';
  }
}

/** O texto numa linha, sem os espaços repetidos. */
const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

/** O texto com parágrafos: no máximo uma linha em branco entre eles. */
const paragraphs = (text: string) =>
  text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** O título como vai para o issue (o "[Sugestão]" o servidor põe). */
export const cleanTitle = (title: string) =>
  oneLine(title).replace(/^\[sugest[ãa]o\]\s*/i, '');

/** O que tem num texto que não pode ficar público. */
export type ContactKind = 'email' | 'at' | 'link' | 'phone' | 'app';

const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const LINK = /https?:|www\.|\.(?:com|br|me)\b|t\.me/i;
const PHONE = /(?:\d[\s().-]*){8,}/;

/**
 * O contato de um texto, pelo filtro da Companhia agora (o mesmo do
 * servidor): `null` se não tem. Diz qual, para a folha pedir para tirar o
 * certo.
 */
export function contactIn(text: string): ContactKind | null {
  if (!hasContact(text)) return null;
  if (EMAIL.test(text)) return 'email';
  if (text.includes('@')) return 'at';
  if (LINK.test(text)) return 'link';
  if (PHONE.test(text)) return 'phone';
  return 'app';
}

/** Por que um campo ainda não vale. */
export type FieldProblem = 'short' | 'long' | ContactKind;

/** O problema do campo é um contato (e não o tamanho). */
export const isContact = (
  problem: FieldProblem | undefined,
): problem is ContactKind =>
  problem !== undefined && problem !== 'short' && problem !== 'long';

export type DraftProblems = Partial<Record<IdeaField | 'area', FieldProblem>>;

/** Os campos que ainda não valem, nas regras do servidor (depois de arrumar o texto). */
export function draftProblems(draft: IdeaDraft): DraftProblems {
  const problems: DraftProblems = {};
  const check = (field: IdeaField, text: string, min: number, max: number) => {
    // o contato vem antes do tamanho: é ele que o aluno precisa tirar
    const found: FieldProblem | null =
      contactIn(text) ??
      (text.length < min ? 'short' : text.length > max ? 'long' : null);
    if (found) problems[field] = found;
  };
  const { title, problem, idea } = IDEA_LIMITS;
  check('title', cleanTitle(draft.title), title.min, title.max);
  check('problem', paragraphs(draft.problem), problem.min, problem.max);
  check('idea', paragraphs(draft.idea), 0, idea.max);
  if (!draft.area) problems.area = 'short';
  return problems;
}

export const isDraftReady = (draft: IdeaDraft) =>
  Object.keys(draftProblems(draft)).length === 0;

/** O título e o problema, para o servidor achar as parecidas. */
export function similarText(draft: IdeaDraft): string {
  const { title, problem } = IDEA_LIMITS;
  return oneLine(`${cleanTitle(draft.title)} ${draft.problem}`).slice(
    0,
    title.max + problem.max + 1,
  );
}

/** O pedido ao servidor; `null` se o rascunho ainda não vale. */
export function newIdea(
  draft: IdeaDraft,
  seenSimilar: readonly number[],
  app: { version: string; platform: IdeaPlatform },
): NewIdea | null {
  if (!draft.area || !isDraftReady(draft)) return null;
  const idea = paragraphs(draft.idea);
  return {
    title: cleanTitle(draft.title),
    area: draft.area,
    problem: paragraphs(draft.problem),
    ...(idea ? { idea } : {}),
    portal: draft.portal,
    appVersion: app.version,
    platform: app.platform,
    seenSimilar: [...new Set(seenSimilar)]
      .filter(number => Number.isInteger(number) && number > 0)
      .slice(0, IDEA_LIMITS.seenSimilar),
  };
}

/** As feitas que o aluno ainda não viu como feitas. */
export const newlyDone = (
  ideas: readonly MyIdea[],
  seen: readonly string[],
): MyIdea[] =>
  ideas.filter(idea => idea.status === 'done' && !seen.includes(idea.id));

/** A sugestão nova (ou o pedido somado) no começo da lista, sem repetir. */
export function withIdea(list: MyIdeas, idea: MyIdea): MyIdeas {
  const others = list.ideas.filter(
    item =>
      item.id !== idea.id &&
      !(
        idea.issue &&
        item.kind === 'joined' &&
        item.issue?.number === idea.issue.number
      ),
  );
  return {
    ideas: [idea, ...others],
    remainingToday:
      idea.kind === 'sent'
        ? Math.max(0, list.remainingToday - 1)
        : list.remainingToday,
  };
}
