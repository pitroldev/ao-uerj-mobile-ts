export interface PreferencesStore {
  read<T>(scope: string, key: string): Promise<T | null>;
  write<T>(scope: string, key: string, value: T): Promise<void>;
  remove(scope: string, key: string): Promise<void>;
}
