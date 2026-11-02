import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /**
   * Um token da Play Integrity (pedido standard) sobre `requestHash`. O
   * provedor é preparado no primeiro pedido e de novo quando vence. Rejeita
   * com `E_INTEGRITY_TRANSIENT` (rede, limite, Play ocupada: tente depois) ou
   * `E_INTEGRITY_UNAVAILABLE` (sem a Play, versão antiga, projeto errado).
   */
  requestToken(
    cloudProjectNumber: string,
    requestHash: string,
  ): Promise<string>;
  /** Bytes do SecureRandom, em base64. */
  randomBytes(length: number): string;
  /** `SHA-256` ou `SHA-384` dos bytes (em base64), em base64. */
  digest(algorithm: string, data: string): string;
}

/** Só existe no Android (módulo local em android/app/.../trust). */
export default TurboModuleRegistry.get<Spec>('DeviceTrust');
