import type { Suggestion } from '../../../modules/suggestions/domain.ts';
import type { SuggestionRepository } from '../../../modules/suggestions/ports.ts';
import { guarded, storedDate, type Stored } from './guarded.ts';
import type { Models } from './models.ts';

type StoredSuggestion = Stored & {
  name: string;
  content: string;
  email?: string;
};

export function toSuggestion(doc: StoredSuggestion): Suggestion {
  return {
    id: String(doc._id),
    name: doc.name,
    content: doc.content,
    email: doc.email,
    createdAt: storedDate(doc.createdAt),
    updatedAt: storedDate(doc.updatedAt),
  };
}

export function createSuggestionRepository(
  model: Models['suggestions'],
): SuggestionRepository {
  return {
    create: suggestion =>
      guarded(async () => {
        const created = await model.create(suggestion);
        return toSuggestion(created.toObject<StoredSuggestion>());
      }),
    listRecent: limit =>
      guarded(async () => {
        const found = await model
          .find()
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean<StoredSuggestion[]>();
        return found.map(toSuggestion);
      }),
  };
}
