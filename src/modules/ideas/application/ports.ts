import type { MyIdea, MyIdeas, NewIdea, SimilarIdea } from '../domain/ideas';

export type RequestOptions = { signal?: AbortSignal };

/**
 * As sugestões no servidor (pitrol.dev/aouerj/v2/ideas). Todo pedido leva a
 * sessão de aluno. As recusas vêm como `IdeaError`; rede, sessão e servidor
 * fora, como `AppError`.
 */
export interface IdeasServerPort {
  /** As que o aluno mandou e os pedidos que ele somou, as mais novas primeiro. */
  mine(options?: RequestOptions): Promise<MyIdeas>;
  /** Até 3 issues abertos parecidos com o texto (vazio sem o GitHub no servidor). */
  similar(text: string, options?: RequestOptions): Promise<SimilarIdea[]>;
  submit(idea: NewIdea): Promise<MyIdea>;
  /** Soma o pedido do aluno a um issue aberto (uma vez por aluno). */
  vote(issue: number): Promise<MyIdea>;
}

/** As preferências da conta (o logout apaga). */
export interface IdeasStorePort {
  read<T>(scope: string, key: string): Promise<T | null>;
  write<T>(scope: string, key: string, value: T): Promise<void>;
}
