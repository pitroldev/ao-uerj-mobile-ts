import type { AppKeyValueStore } from '@root/modules/delivery/application/ports';
import type { PreferencesStore } from '@root/modules/identity/application/PreferencesStore';

/**
 * Escopo fixo das preferências do app inteiro. Os das contas são
 * `account-…`, então não colidem, e o logout não apaga estes valores.
 */
export const APP_SCOPE = 'app';

export function createAppKeyValueStore(
  preferences: PreferencesStore,
): AppKeyValueStore {
  return {
    read<T>(key: string) {
      return preferences.read<T>(APP_SCOPE, key);
    },
    write<T>(key: string, value: T) {
      return preferences.write(APP_SCOPE, key, value);
    },
  };
}
