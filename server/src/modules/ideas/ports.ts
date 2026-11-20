import type { StudentActor } from '../students/ports.ts';
import type {
  GitHubIssue,
  Idea,
  IdeaArea,
  IdeaStatus,
  IdeaVote,
  IssueStatus,
  NewIdea,
  TrackedIssue,
} from './domain.ts';

/**
 * Uma sugestão do aluno, como o app mostra em "Minhas sugestões": a que ele
 * mandou (`sent`) ou o pedido que ele somou a um issue (`joined`).
 */
export type MyIdea = {
  id: string;
  kind: 'sent' | 'joined';
  title: string;
  area: IdeaArea | null;
  createdAt: Date;
  /** `received` espera a moderação; `not_published`, ela não publicou. */
  status: 'received' | 'not_published' | IssueStatus;
  issue: { number: number; url: string } | null;
  /** Quantos pediram: os alunos pelo app e os 👍 no GitHub. */
  requests: number;
};

/** Um issue parecido, para o aluno somar o pedido em vez de repetir. */
export type SimilarIssue = {
  number: number;
  title: string;
  url: string;
  status: IssueStatus;
  requests: number;
};

/** O que a moderação vê: as que esperam e as decididas por último. */
export type IdeaReview = { received: Idea[]; decided: Idea[] };

export type PublishResult =
  | { result: 'published'; issue: TrackedIssue }
  /** Já decidida, ou não existe. */
  | { result: 'gone' }
  /** Sem o GitHub configurado. */
  | { result: 'unavailable' };

/** Porta de entrada: as sugestões do app. */
export interface Ideas {
  /** O GitHub está configurado: dá para publicar. */
  publishing(): boolean;
  /** O repositório dos issues ("dono/nome"); `null` sem o GitHub. */
  repository(): string | null;
  /**
   * As do aluno e os pedidos que ele somou, as mais novas primeiro, e
   * quantas ele ainda pode mandar hoje.
   */
  mine(
    actor: StudentActor,
  ): Promise<{ ideas: MyIdea[]; remainingToday: number }>;
  /** Os issues de sugestão abertos parecidos com o texto (até 3). */
  similar(text: string): Promise<SimilarIssue[]>;
  /** Guarda para a moderação; `LimitError` passado o limite do dia. */
  submit(request: NewIdea, actor: StudentActor): Promise<MyIdea>;
  /** Soma o pedido do aluno a um issue de sugestão aberto (uma vez por aluno). */
  vote(issue: number, actor: StudentActor): Promise<MyIdea>;

  /** Para a moderação. */
  forReview(): Promise<IdeaReview>;
  find(id: string): Promise<Idea | null>;
  /** Os issues abertos parecidos com a ideia, para "Juntar à #N". */
  similarFor(idea: Idea): Promise<SimilarIssue[]>;
  /** Abre o issue no GitHub e soma o pedido de quem mandou. */
  publish(id: string): Promise<PublishResult>;
  /** Junta a um issue que já existe: o pedido de quem mandou vai para ele. */
  merge(
    id: string,
    issue: number,
  ): Promise<'merged' | 'gone' | 'issue_not_found' | 'unavailable'>;
  archive(id: string): Promise<'archived' | 'gone'>;
  /** Desfaz o arquivar: volta a esperar a moderação. */
  reopen(id: string): Promise<'reopened' | 'gone'>;
  /** A rodada: o estado dos issues acompanhados, no GitHub. Quantos leu. */
  syncIssues(): Promise<number>;
}

/** Porta de saída: as sugestões guardadas. */
export interface IdeaRepository {
  create(idea: Omit<Idea, 'id'>): Promise<Idea>;
  find(id: string): Promise<Idea | null>;
  listByStudent(studentId: string, limit: number): Promise<Idea[]>;
  /** Quantas o aluno mandou desde `since` (o limite do dia). */
  countByStudentSince(studentId: string, since: Date): Promise<number>;
  /** Nas situações pedidas, as mais novas primeiro. */
  listByStatus(statuses: readonly IdeaStatus[], limit: number): Promise<Idea[]>;
  /**
   * Grava a decisão se a ideia ainda estiver em `from` (duas abas não
   * publicam duas vezes); `null` se não mudou.
   */
  decide(
    id: string,
    from: IdeaStatus,
    to: { status: IdeaStatus; issue: number | null; at: Date | null },
  ): Promise<Idea | null>;
  /** Os issues que as ideias apontam (para a rodada). */
  listIssueNumbers(): Promise<number[]>;
}

/** Porta de saída: os pedidos somados, um por aluno e issue. */
export interface IdeaVoteRepository {
  /** `false` se o aluno já tinha pedido esse issue. */
  add(vote: IdeaVote): Promise<boolean>;
  listByStudent(studentId: string): Promise<IdeaVote[]>;
  count(issue: number): Promise<number>;
  listIssueNumbers(): Promise<number[]>;
}

/** Porta de saída: o que o GitHub disse por último de cada issue acompanhado. */
export interface TrackedIssueRepository {
  put(issue: TrackedIssue): Promise<void>;
  findMany(numbers: readonly number[]): Promise<TrackedIssue[]>;
}

/** Porta de saída: os issues do repositório (o GitHub, pela conta do app). */
export interface IssueTracker {
  /** "dono/nome". */
  readonly repository: string;
  createIssue(issue: {
    title: string;
    body: string;
    type: string;
    labels: string[];
  }): Promise<GitHubIssue>;
  /** `null` se não existe (ou foi apagado). */
  getIssue(number: number): Promise<GitHubIssue | null>;
  /** Os abertos do tipo, os atualizados por último primeiro (até 100). */
  listOpen(type: string): Promise<GitHubIssue[]>;
  /** Cria ou edita o comentário do servidor que tem a marca. */
  upsertComment(issue: number, marker: string, body: string): Promise<void>;
}
