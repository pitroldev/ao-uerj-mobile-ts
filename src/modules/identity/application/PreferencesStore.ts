export interface PreferencesStore {
  read<T>(scope: string, key: string): Promise<T | null>;
  write<T>(scope: string, key: string, value: T): Promise<void>;
  /**
   * Reads, changes and writes in a single turn of the key's queue, so nothing
   * (not even logout's removal) runs between the read and the write.
   */
  update<T>(
    scope: string,
    key: string,
    change: (current: T | null) => T,
  ): Promise<T>;
  remove(scope: string, key: string): Promise<void>;
}
