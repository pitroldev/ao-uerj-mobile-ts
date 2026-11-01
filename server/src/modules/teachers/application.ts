import { cacheFor, systemClock, type Clock } from '../../shared/clock.ts';
import { SEARCH_LIMIT, sortNames } from './domain.ts';
import type { TeacherDirectory, TeacherRepository } from './ports.ts';

/**
 * Os nomes em ordem alfabética, guardados por `cacheMs`: a lista é grande e
 * muda pouco. A busca vai sempre ao banco.
 */
export function createTeacherDirectory(
  teachers: TeacherRepository,
  { cacheMs, now = systemClock }: { cacheMs: number; now?: Clock },
): TeacherDirectory {
  const names = cacheFor(async () => sortNames(await teachers.listNames()), {
    ttlMs: cacheMs,
    now,
  });

  return {
    names: () => names.get(),
    search: fragment => teachers.searchByName(fragment, SEARCH_LIMIT),
  };
}
