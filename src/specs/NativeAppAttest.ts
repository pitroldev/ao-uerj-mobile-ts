import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * O App Attest da Apple (DeviceCheck) e a criptografia da plataforma no
 * iPhone, para a sessão de aluno (src/modules/trust), como o `DeviceTrust`
 * (Play Integrity) no Android.
 */
export interface Spec extends TurboModule {
  /**
   * O App Attest funciona neste aparelho: um iPhone de verdade, com o Secure
   * Enclave. No simulador, nunca.
   */
  isSupported(): boolean;
  /**
   * Gera uma chave nova do App Attest (`generateKey`) e pede à Apple que a
   * ateste (`attestKey`) com `clientDataHash` (32 bytes, em base64). Resolve
   * com o id da chave e o objeto de atestação, em base64 padrão. Rejeita com
   * `E_APP_ATTEST_TRANSIENT` (rede, servidor da Apple fora: tente depois) ou
   * `E_APP_ATTEST_UNAVAILABLE` (sem suporte, chave recusada, pedido errado).
   */
  attest(
    clientDataHash: string,
  ): Promise<{ keyId: string; attestation: string }>;
  /** Bytes do SecRandomCopyBytes, em base64. */
  randomBytes(length: number): string;
  /** `SHA-256` ou `SHA-384` dos bytes (em base64), em base64. */
  digest(algorithm: string, data: string): string;
}

/** Só existe no iOS (ios/AOUerjMobile/Native/AppAttestModule.mm). */
export default TurboModuleRegistry.get<Spec>('AppAttest');
