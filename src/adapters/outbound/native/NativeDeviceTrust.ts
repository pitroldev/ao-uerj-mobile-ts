import NativeDeviceTrust, { type Spec } from '@root/specs/NativeDeviceTrust';
import type { DeviceTrustPort } from '@root/modules/trust/application/ports';
import { platformCrypto } from './platformCrypto';

/**
 * O número (não o id) do projeto do Google Cloud ligado ao app no Play
 * Console, o `ao-uerj`: a Play Integrity o exige no pedido standard. Não é
 * segredo. Vazio, o app não entra como aluno.
 */
const CLOUD_PROJECT_NUMBER = '377368074507';

/**
 * A Play Integrity e a criptografia da plataforma (SHA-2 e SecureRandom) pelo
 * módulo nativo local. `null` no iOS (o módulo só existe no Android; lá, o
 * App Attest) ou sem o número do projeto.
 */
export function createNativeDeviceTrust(
  module: Spec | null | undefined = NativeDeviceTrust,
  cloudProjectNumber = CLOUD_PROJECT_NUMBER,
): DeviceTrustPort | null {
  if (!module || !/^\d+$/.test(cloudProjectNumber)) return null;
  return {
    crypto: platformCrypto(module),
    async attest(requestHash) {
      try {
        return {
          token: await module.requestToken(cloudProjectNumber, requestHash),
        };
      } catch (error) {
        const code = (error as { code?: unknown } | null)?.code;
        return {
          failure:
            code === 'E_INTEGRITY_TRANSIENT' ? 'transient' : 'unavailable',
        };
      }
    },
  };
}
