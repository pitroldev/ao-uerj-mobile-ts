import type { Suggestion } from '../../../modules/suggestions/domain.ts';
import type { SuggestionRepository } from '../../../modules/suggestions/ports.ts';
import { guarded, storedDate, type Stored } from './guarded.ts';
import type { Models } from './models.ts';

type StoredSuggestion = Stored & {
  name: string;
  content: string;
  email?: string;
  archivedAt?: Date | null;
};

/** Um id do Mongo; outro texto não chega a virar consulta (nem um CastError). */
const OBJECT_ID = /^[0-9a-f]{24}$/i;

export function toSuggestion(doc: StoredSuggestion): Suggestion {
  return {
    id: String(doc._id),
    name: doc.name,
    content: doc.content,
    email: doc.email,
    archivedAt: doc.archivedAt ?? null,
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
    setArchivedAt: (id, at) =>
      guarded(async () => {
        if (!OBJECT_ID.test(id)) return null;
        const updated = await model
          .findByIdAndUpdate(
            id,
            { archivedAt: at },
            { returnDocument: 'after' },
          )
          .lean<StoredSuggestion>();
        return updated ? toSuggestion(updated) : null;
      }),
  };
}
