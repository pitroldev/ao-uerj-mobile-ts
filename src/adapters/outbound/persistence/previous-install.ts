import type { CredentialStore } from '@root/modules/identity/application/ports';

type Storage = {
  getAllKeys(): Promise<readonly string[]>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

/** Marca desta instalação no AsyncStorage (que a desinstalação apaga). */
export const INSTALL_MARKER = 'ao:v2:install';

/**
 * No iOS o Keychain sobrevive à desinstalação: quem apagasse o app e o
 * instalasse de novo voltaria logado com a senha antiga. Na primeira abertura
 * de uma instalação, uma conta salva sem nenhum dado dela no armazenamento
 * (cache, preferências) é de antes da desinstalação e é esquecida; numa
 * atualização, esses dados existem. Uma falha não impede a abertura: a marca
 * só é gravada quando tudo deu certo, e a próxima abertura tenta de novo.
 */
export async function forgetCredentialsOfPreviousInstall(
  storage: Storage,
  credentials: Pick<CredentialStore, 'read' | 'clear'>,
): Promise<void> {
  try {
    if (await storage.getItem(INSTALL_MARKER)) return;
    const saved = await credentials.read().catch(() => null);
    if (saved) {
      const { scope } = saved.account;
      const encoded = encodeURIComponent(scope);
      const keys = await storage.getAllKeys();
      const used = keys.some(
        key => key.includes(scope) || key.includes(encoded),
      );
      if (!used) await credentials.clear();
    }
    await storage.setItem(INSTALL_MARKER, '1');
  } catch {
    // a próxima abertura tenta de novo
  }
}
