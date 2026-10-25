import NativeSecureVault, { type Spec } from '@root/specs/NativeSecureVault';
import type { SecureVault } from '../persistence/vault-storage';

/** Cofre cifrado do aparelho; `null` onde o módulo não existe. */
export function createSecureVault(
  module: Spec | null | undefined = NativeSecureVault,
): SecureVault | null {
  if (!module) return null;
  return {
    read: name => module.read(name),
    write: (name, value) => module.write(name, value),
    remove: name => module.remove(name),
    removePrefix: prefix => module.removePrefix(prefix),
  };
}
