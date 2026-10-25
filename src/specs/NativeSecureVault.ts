import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Cofre do aparelho: textos cifrados com AES-GCM em arquivos fora do backup,
 * com a chave no Android Keystore ou, no iOS, no Keychain (ECIES com P-256,
 * ios/AOUerjMobile/Native/SecureVaultModule.mm). Guarda o cache acadêmico de
 * longa duração e os documentos que o aluno pediu para guardar.
 */
export interface Spec extends TurboModule {
  /** `null` sem o item, ou se ele não puder mais ser decifrado (é apagado). */
  read(name: string): Promise<string | null>;
  write(name: string, value: string): Promise<void>;
  remove(name: string): Promise<void>;
  /** Apaga todos os itens cujo nome começa com `prefix` (logout). */
  removePrefix(prefix: string): Promise<void>;
}

export default TurboModuleRegistry.get<Spec>('SecureVault');
