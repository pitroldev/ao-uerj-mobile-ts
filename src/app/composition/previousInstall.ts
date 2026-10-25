import { Platform } from 'react-native';
import { forgetCredentialsOfPreviousInstall } from '@root/adapters/outbound/persistence/previous-install';

/**
 * Só no iOS, onde o Keychain sobrevive à desinstalação. No Android a
 * desinstalação apaga o Keystore, e o cache fica no cofre, fora do
 * AsyncStorage, então a regra não serve lá.
 */
export function forgetPreviousInstall(
  ...args: Parameters<typeof forgetCredentialsOfPreviousInstall>
): Promise<void> {
  return Platform.OS === 'ios'
    ? forgetCredentialsOfPreviousInstall(...args)
    : Promise.resolve();
}
