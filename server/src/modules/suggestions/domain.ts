/** Sugestões mandadas pelos apps antigos (o atual não manda mais). */

export type NewSuggestion = {
  name: string;
  content: string;
  email?: string;
};

export type Suggestion = NewSuggestion & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Os apps 1.x não limitavam os campos: os limites ficam bem acima do uso. */
export const SUGGESTION_LIMITS = {
  name: 200,
  content: 10000,
  email: 254,
} as const;

/** A listagem de administração traz as mais recentes, no máximo estas. */
export const RECENT_SUGGESTIONS = 200;
