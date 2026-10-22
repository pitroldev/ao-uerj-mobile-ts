import type { KeyValueStorage } from './storage';

/** Cofre cifrado do aparelho (módulo nativo do Android). */
export type SecureVault = {
  read(name: string): Promise<string | null>;
  write(name: string, value: string): Promise<void>;
  remove(name: string): Promise<void>;
  removePrefix(prefix: string): Promise<void>;
};

/**
 * O cache das consultas no cofre. A cópia antiga, sem cifra, é lida uma vez
 * (atualização do app) e apagada na primeira gravação. Uma falha do cofre
 * nunca impede o app de abrir: a leitura volta à cópia antiga (ou vazia) e a
 * gravação é pulada.
 */
export function createVaultStorage(
  vault: SecureVault,
  legacy: KeyValueStorage,
): KeyValueStorage {
  return {
    async getItem(key) {
      const saved = await vault.read(key).catch(() => null);
      return saved ?? legacy.getItem(key).catch(() => null);
    },
    async setItem(key, value) {
      try {
        await vault.write(key, value);
      } catch {
        return;
      }
      await legacy.removeItem(key).catch(() => undefined);
    },
    async removeItem(key) {
      await Promise.all([
        vault.remove(key).catch(() => undefined),
        legacy.removeItem(key),
      ]);
    },
  };
}
