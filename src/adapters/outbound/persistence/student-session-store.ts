import type {
  StoredSession,
  StudentSessionStorePort,
} from '@root/modules/trust/application/ports';
import type { SecureVault } from './vault-storage';

const SESSION = 'trust:session';
// o mesmo item dos tokens anônimos de antes: o aparelho continua o mesmo
const INSTALLATION = 'trust:installation';
// o estoque dos tokens anônimos, que o app não usa mais
const OLD_STOCK = 'trust:stock';

function parse(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredSession> | null;
    if (
      typeof value?.token === 'string' &&
      typeof value.scope === 'string' &&
      typeof value.expiresAt === 'number'
    )
      return {
        token: value.token,
        scope: value.scope,
        expiresAt: value.expiresAt,
      };
  } catch {
    // um item estragado vale como sem sessão: o app entra de novo
  }
  return null;
}

/**
 * A sessão de aluno e o id da instalação, em itens cifrados do cofre (fora
 * do backup do Android: não passam para outro aparelho).
 */
export function createStudentSessionStore(
  vault: SecureVault,
): StudentSessionStorePort {
  return {
    read: async () => parse(await vault.read(SESSION)),
    write: session => vault.write(SESSION, JSON.stringify(session)),
    async clear() {
      await vault.remove(SESSION);
      await vault.remove(OLD_STOCK);
    },
    readInstallation: () => vault.read(INSTALLATION),
    writeInstallation: installation => vault.write(INSTALLATION, installation),
  };
}
