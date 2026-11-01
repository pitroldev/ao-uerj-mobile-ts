import type { NewSuggestion, Suggestion } from './domain.ts';

/** Porta de entrada: as sugestões dos apps antigos. */
export interface Suggestions {
  submit(suggestion: NewSuggestion): Promise<Suggestion>;
  /** As mais recentes, para a administração. */
  listRecent(): Promise<Suggestion[]>;
}

/** Porta de saída: onde as sugestões ficam. */
export interface SuggestionRepository {
  create(suggestion: NewSuggestion): Promise<Suggestion>;
  listRecent(limit: number): Promise<Suggestion[]>;
}
