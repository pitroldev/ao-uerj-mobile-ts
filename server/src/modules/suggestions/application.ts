import { RECENT_SUGGESTIONS } from './domain.ts';
import type { SuggestionRepository, Suggestions } from './ports.ts';

export function createSuggestions(
  suggestions: SuggestionRepository,
): Suggestions {
  return {
    submit: suggestion => suggestions.create(suggestion),
    listRecent: () => suggestions.listRecent(RECENT_SUGGESTIONS),
  };
}
