import { fromBase64, toBase64 } from '@root/modules/trust/domain/bytes';
import type { SessionCrypto } from '@root/modules/trust/domain/studentSession';

/** O que os módulos de atestação têm em comum: SHA-2 e bytes ao acaso, em base64. */
type PlatformCryptoModule = {
  randomBytes(length: number): string;
  digest(algorithm: string, data: string): string;
};

function bytes(value: string): Uint8Array {
  const decoded = fromBase64(value);
  if (!decoded) throw new Error('the native module returned invalid base64');
  return decoded;
}

/**
 * O SHA-256 e os bytes ao acaso da plataforma pelo módulo nativo: o
 * MessageDigest e o SecureRandom no Android, o CommonCrypto e o
 * SecRandomCopyBytes no iPhone.
 */
export function platformCrypto(module: PlatformCryptoModule): SessionCrypto {
  return {
    sha256: data => bytes(module.digest('SHA-256', toBase64(data))),
    randomBytes: length => bytes(module.randomBytes(length)),
  };
}
