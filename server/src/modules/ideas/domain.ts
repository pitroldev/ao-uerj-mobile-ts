import { hasContact } from '../../shared/contact.ts';
import { DomainError, InvalidInputError } from '../../shared/errors.ts';

/*
 * As sugestões do app (a "Sugerir uma ideia" da 2.x): o aluno identificado
 * manda a ideia, a moderação olha e a publica como issue no GitHub (público),
 * e o estado do issue volta para o app. No GitHub não vai nada de quem
 * mandou: o servidor guarda o aluno só para o limite do dia e para mostrar a
 * ele as dele. As sugestões dos apps 1.x (modules/suggestions) são outra
 * coisa e ficam como estão.
 */

/** Onde no app a ideia mexe (vira a etiqueta "área: …"). */
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

export const AREA_LABEL: Record<IdeaArea, string> = {
  home: 'Início',
  schedule: 'Grade',
  grades: 'Notas',
  rid: 'RID',
  subjects: 'Disciplinas',
  generator: 'Gerador de grade',
  companion: 'Companhia agora',
  campus: 'Agora no campus',
  map: 'Mapa',
  mural: 'Mural',
  other: 'Outro',
};

/** "O Aluno Online já faz isso?", com as opções do formulário do GitHub. */
export const PORTAL_ANSWERS = ['yes_bad', 'no', 'unknown'] as const;
export type PortalAnswer = (typeof PORTAL_ANSWERS)[number];

export const PORTAL_LABEL: Record<PortalAnswer, string> = {
  yes_bad: 'Sim, mas é ruim de usar no celular',
  no: 'Não',
  unknown: 'Não sei',
};

export const IDEA_PLATFORMS = ['android', 'ios'] as const;
export type IdeaPlatform = (typeof IDEA_PLATFORMS)[number];

export const IDEA_LIMITS = {
  title: { min: 4, max: 80 },
  problem: { min: 10, max: 1000 },
  idea: { max: 1000 },
  appVersion: 20,
  /** As parecidas que o app mostrou e o aluno seguiu mesmo assim. */
  seenSimilar: 5,
  /** Por aluno, por dia de São Paulo. */
  perDay: 3,
} as const;

/**
 * O tipo de issue das sugestões, entre os do GitHub (Bug, Feature, Task): o
 * mesmo que o formulário de sugestão do repositório põe.
 */
export const SUGGESTION_TYPE = 'Feature';

/**
 * As etiquetas do repositório que o servidor usa. As de estado (planejada,
 * em andamento) põe você, no GitHub; o app só as lê.
 */
export const LABELS = {
  fromApp: 'sugestão do app',
  planned: 'status: planejada',
  inProgress: 'status: em andamento',
  area: (area: IdeaArea) => `área: ${AREA_LABEL[area]}`,
} as const;

/**
 * Recebida (esperando a moderação), publicada (virou um issue), juntada (a um
 * issue que já existia) ou arquivada (a moderação não publicou).
 */
export type IdeaStatus = 'received' | 'published' | 'merged' | 'archived';

export type NewIdea = {
  title: string;
  area: IdeaArea;
  problem: string;
  idea: string | null;
  portal: PortalAnswer;
  appVersion: string;
  platform: IdeaPlatform;
  /**
   * Os issues parecidos que o app mostrou antes de enviar: o aluno disse que
   * a dele é outra.
   */
  seenSimilar: number[];
};

export type Idea = NewIdea & {
  id: string;
  studentId: string;
  status: IdeaStatus;
  /** O issue dela (publicada ou juntada). */
  issue: number | null;
  createdAt: Date;
  /** Quando a moderação decidiu. */
  reviewedAt: Date | null;
};

/** Um pedido somado a um issue: um por aluno e issue. */
export type IdeaVote = { issue: number; studentId: string; createdAt: Date };

/** O estado de um issue, como o app mostra. */
export type IssueStatus =
  'open' | 'planned' | 'in_progress' | 'done' | 'closed';

/** Um issue de sugestão que o servidor acompanha (o que o GitHub disse por último). */
export type TrackedIssue = {
  number: number;
  title: string;
  url: string;
  status: IssueStatus;
  /** Os 👍 do issue no GitHub. */
  plusOnes: number;
  /** Aberto pelo app (com a etiqueta "sugestão do app"). */
  fromApp: boolean;
  updatedAt: Date;
};

/** O que o GitHub diz de um issue. */
export type GitHubIssue = {
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
  /** "completed", "not_planned", "duplicate"…; `null` aberto. */
  stateReason: string | null;
  /** "Bug", "Feature", "Task"; `null` sem tipo. */
  type: string | null;
  labels: string[];
  plusOnes: number;
  pullRequest: boolean;
  updatedAt: Date;
};

/** O estado que o app mostra, pelas etiquetas e pelo jeito que fechou. */
export function issueStatusOf(
  issue: Pick<GitHubIssue, 'state' | 'stateReason' | 'labels'>,
): IssueStatus {
  if (issue.state === 'closed')
    return issue.stateReason === 'completed' ? 'done' : 'closed';
  if (issue.labels.includes(LABELS.inProgress)) return 'in_progress';
  if (issue.labels.includes(LABELS.planned)) return 'planned';
  return 'open';
}

export const trackedOf = (issue: GitHubIssue): TrackedIssue => ({
  number: issue.number,
  title: issue.title,
  url: issue.url,
  status: issueStatusOf(issue),
  plusOnes: issue.plusOnes,
  fromApp: issue.labels.includes(LABELS.fromApp),
  updatedAt: issue.updatedAt,
});

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

/**
 * A ideia conferida: os tamanhos e nada de contato (a sugestão fica
 * pública). O código `idea_contact` diz ao app qual campo tirar.
 */
export function checkIdea(request: NewIdea): NewIdea {
  const title = oneLine(request.title).replace(/^\[sugest[ãa]o\]\s*/i, '');
  const problem = paragraphs(request.problem);
  const idea = request.idea ? paragraphs(request.idea) : '';
  const { title: t, problem: p } = IDEA_LIMITS;
  if (title.length < t.min || title.length > t.max)
    throw new InvalidInputError(
      `title must have from ${t.min} to ${t.max} characters`,
    );
  if (problem.length < p.min || problem.length > p.max)
    throw new InvalidInputError(
      `problem must have from ${p.min} to ${p.max} characters`,
    );
  if (idea.length > IDEA_LIMITS.idea.max)
    throw new InvalidInputError(
      `idea must have at most ${IDEA_LIMITS.idea.max} characters`,
    );
  for (const [field, text] of [
    ['title', title],
    ['problem', problem],
    ['idea', idea],
  ] as const)
    if (hasContact(text))
      throw new DomainError(
        'idea_contact',
        `The ${field} cannot carry a phone number, an e-mail, an @ or a link: the suggestion is public`,
      );
  const seenSimilar = [...new Set(request.seenSimilar)]
    .filter(number => Number.isInteger(number) && number > 0)
    .slice(0, IDEA_LIMITS.seenSimilar);
  return { ...request, title, problem, idea: idea || null, seenSimilar };
}

/** O título do issue, como o formulário de sugestão do repositório faz. */
export const issueTitle = (idea: Pick<Idea, 'title'>) =>
  `[Sugestão] ${idea.title}`;

/** Um texto do aluno como parágrafo do Markdown, sem virar título nem citação. */
const markdownText = (text: string) =>
  text
    .split('\n')
    .map(line => line.replace(/^(\s*)([#>])/, '$1\\$2'))
    .join('\n');

const PLATFORM_LABEL: Record<IdeaPlatform, string> = {
  android: 'Android',
  ios: 'iPhone',
};

/**
 * O corpo do issue, nas mesmas seções do formulário de sugestão do GitHub.
 * Sem nada de quem mandou.
 */
export function issueBody(idea: Omit<NewIdea, 'title'>): string {
  return [
    '### Qual problema isso resolve?',
    '',
    markdownText(idea.problem),
    '',
    '### Como você imagina?',
    '',
    idea.idea ? markdownText(idea.idea) : '_Não descreveu._',
    '',
    '### O Aluno Online já faz isso?',
    '',
    PORTAL_LABEL[idea.portal],
    '',
    '### Onde no app',
    '',
    AREA_LABEL[idea.area],
    '',
    '---',
    '',
    `<sub>Enviada pelo app AO UERJ ${idea.appVersion} (${PLATFORM_LABEL[idea.platform]}), sem nome, matrícula nem e-mail. Para pedir também, use "Sugerir uma ideia" no app ou reaja com 👍.</sub>`,
  ].join('\n');
}

/** A marca do comentário que o servidor mantém com a contagem do app. */
export const VOTES_MARKER = '<!-- ao-uerj:pedidos -->';

/** O comentário com quantos alunos pediram pelo app. */
export const votesComment = (count: number) =>
  `${VOTES_MARKER}\n**${count} ${count === 1 ? 'aluno pediu' : 'alunos pediram'}** isto pelo app AO UERJ (sem nome, matrícula nem e-mail).`;

/*
 * As parecidas: palavras em comum entre o que o aluno escreveu e o título dos
 * issues abertos, sem acento, sem as palavras curtas e as que não dizem nada.
 */

const STOPWORDS = new Set(
  'aqui assim cada coisa como com das dela dele depois dos ela ele essa esse esta este eu isso isto mais mas muito nao nas nem nos num numa onde para pela pelo por pra quando que quero sem ser sobre sua seu tem ter uma uns umas vai ver app sugestao queria poder seria tela'.split(
    ' ',
  ),
);

/** As palavras que contam, sem acento e sem o plural. */
export function words(text: string): Set<string> {
  const plain = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const out = new Set<string>();
  for (const raw of plain.split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || STOPWORDS.has(raw)) continue;
    out.add(raw.length > 4 && raw.endsWith('s') ? raw.slice(0, -1) : raw);
  }
  return out;
}

/**
 * Os issues mais parecidos com o texto, os mais parecidos primeiro: pelo
 * menos uma palavra de 4 letras em comum e um terço das palavras do menor.
 */
export function similarIssues<T extends { title: string }>(
  text: string,
  issues: readonly T[],
  limit = 3,
): T[] {
  const mine = words(text);
  if (!mine.size) return [];
  return issues
    .map(issue => {
      const theirs = words(issue.title.replace(/^\[sugest[ãa]o\]/i, ''));
      const common = [...mine].filter(word => theirs.has(word));
      const score = theirs.size
        ? common.length / Math.min(mine.size, theirs.size)
        : 0;
      return { issue, score, strong: common.some(word => word.length >= 4) };
    })
    .filter(item => item.strong && item.score >= 1 / 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.issue);
}
