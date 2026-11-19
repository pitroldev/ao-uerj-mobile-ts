import { systemClock, type Clock } from '../../shared/clock.ts';
import { RECENT_SUGGESTIONS } from './domain.ts';
import type { SuggestionRepository, Suggestions } from './ports.ts';

export function createSuggestions(
  suggestions: SuggestionRepository,
  { now = systemClock }: { now?: Clock } = {},
): Suggestions {
  return {
    submit: suggestion => suggestions.create(suggestion),
    listRecent: () => suggestions.listRecent(RECENT_SUGGESTIONS),
    setArchived: (id, archived) =>
      suggestions.setArchivedAt(id, archived ? new Date(now()) : null),
  };
}
