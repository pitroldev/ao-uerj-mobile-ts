import NativeDeviceTrust, { type Spec } from '@root/specs/NativeDeviceTrust';
import { fromBase64, toBase64 } from '@root/modules/trust/domain/bytes';
import type { DeviceTrustPort } from '@root/modules/trust/application/ports';

/**
 * O número (não o id) do projeto do Google Cloud ligado ao app no Play
 * Console, o `ao-uerj`: a Play Integrity o exige no pedido standard. Não é
 * segredo. Vazio, o app não pede tokens.
 */
const CLOUD_PROJECT_NUMBER = '377368074507';

function bytes(value: string): Uint8Array {
  const decoded = fromBase64(value);
  if (!decoded) throw new Error('the native module returned invalid base64');
  return decoded;
}

/**
 * A Play Integrity e a criptografia da plataforma (SHA-2 e SecureRandom) pelo
 * módulo nativo local. `null` no iOS (o módulo só existe no Android) ou sem o
 * número do projeto.
 */
export function createNativeDeviceTrust(
  module: Spec | null | undefined = NativeDeviceTrust,
  cloudProjectNumber = CLOUD_PROJECT_NUMBER,
): DeviceTrustPort | null {
  if (!module || !/^\d+$/.test(cloudProjectNumber)) return null;
  return {
    crypto: {
      sha256: data => bytes(module.digest('SHA-256', toBase64(data))),
      sha384: data => bytes(module.digest('SHA-384', toBase64(data))),
      randomBytes: length => bytes(module.randomBytes(length)),
    },
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
