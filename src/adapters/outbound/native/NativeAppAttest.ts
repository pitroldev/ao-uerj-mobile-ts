import NativeAppAttest, { type Spec } from '@root/specs/NativeAppAttest';
import { fromHex, toBase64 } from '@root/modules/trust/domain/bytes';
import type { DeviceTrustPort } from '@root/modules/trust/application/ports';
import { platformCrypto } from './platformCrypto';

/** O `clientDataHash` do App Attest: os 32 bytes do SHA-256 do pedido. */
const CLIENT_DATA_HASH_BYTES = 32;

/** O App Attest funciona aqui? Um erro do módulo conta como não. */
function isSupported(module: Spec): boolean {
  try {
    return module.isSupported();
  } catch {
    return false;
  }
}

/**
 * O App Attest da Apple e a criptografia da plataforma (CommonCrypto e
 * SecRandomCopyBytes) pelo módulo nativo local. Cada entrada gera uma chave
 * nova, atestada sobre os bytes do pedido. `null` no Android (o módulo só
 * existe no iOS) e onde o App Attest não funciona (o simulador).
 */
export function createNativeAppAttest(
  module: Spec | null | undefined = NativeAppAttest,
): DeviceTrustPort | null {
  if (!module || !isSupported(module)) return null;
  return {
    crypto: platformCrypto(module),
    async attest(requestHash) {
      // a Apple recebe os bytes do hash, não o texto em hex
      const clientDataHash = fromHex(requestHash);
      if (clientDataHash?.length !== CLIENT_DATA_HASH_BYTES)
        return { failure: 'unavailable' };
      try {
        const { keyId, attestation } = await module.attest(
          toBase64(clientDataHash),
        );
        if (!keyId || !attestation) return { failure: 'unavailable' };
        return { appAttest: { keyId, attestation } };
      } catch (error) {
        const code = (error as { code?: unknown } | null)?.code;
        return {
          failure:
            code === 'E_APP_ATTEST_TRANSIENT' ? 'transient' : 'unavailable',
        };
      }
    },
  };
}
