import type { PreferencesStore } from '@root/modules/identity/application/PreferencesStore';
import { AppError } from '@root/shared/errors/AppError';
import type { KeyValueStorage } from './storage';

export function createPreferencesStore(
  storage: KeyValueStorage,
): PreferencesStore {
  const name = (scope: string, key: string) =>
    `ao:v2:preferences:${encodeURIComponent(scope)}:${encodeURIComponent(key)}`;
  const pending = new Map<string, Promise<unknown>>();

  function enqueue<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = pending.get(key) ?? Promise.resolve();
    const task = previous
      .catch(() => undefined)
      .then(async () => {
        try {
          return await operation();
        } catch {
          throw new AppError('STORAGE_FAILED');
        }
      });
    pending.set(key, task);
    const release = () => {
      if (pending.get(key) === task) pending.delete(key);
    };
    task.then(release, release);
    return task;
  }

  return {
    async read<T>(scope: string, key: string): Promise<T | null> {
      const storageKey = name(scope, key);
      return enqueue(storageKey, async () => {
        const value = await storage.getItem(storageKey);
        return value === null ? null : (JSON.parse(value) as T);
      });
    },
    async write<T>(scope: string, key: string, value: T) {
      const storageKey = name(scope, key);
      return enqueue(storageKey, () =>
        storage.setItem(storageKey, JSON.stringify(value)),
      );
    },
    async remove(scope: string, key: string) {
      const storageKey = name(scope, key);
      // Logout's removal follows any write already in flight for this account.
      return enqueue(storageKey, () => storage.removeItem(storageKey));
    },
  };
}
