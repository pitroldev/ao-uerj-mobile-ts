import type { TokenStorePort } from '@root/modules/trust/application/ports';
import { parseTokenStock } from '@root/modules/trust/domain/tokenStock';
import type { SecureVault } from './vault-storage';

const STOCK = 'trust:stock';
const INSTALLATION = 'trust:installation';

/**
 * Os tokens anônimos e o id da instalação, em itens cifrados do cofre (fora
 * do backup do Android: o id não passa para outro aparelho).
 */
export function createTokenStore(vault: SecureVault): TokenStorePort {
  return {
    async readStock() {
      const raw = await vault.read(STOCK);
      if (!raw) return null;
      try {
        return parseTokenStock(JSON.parse(raw));
      } catch {
        return null;
      }
    },
    writeStock: stock =>
      stock.tokens.length || stock.retryAt !== null
        ? vault.write(STOCK, JSON.stringify(stock))
        : vault.remove(STOCK),
    readInstallation: () => vault.read(INSTALLATION),
    writeInstallation: installation => vault.write(INSTALLATION, installation),
  };
}
