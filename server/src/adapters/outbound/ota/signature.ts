import { verify, X509Certificate } from 'node:crypto';

import type { OtaSignatureVerifier } from '../../../modules/ota/ports.ts';

/**
 * Confere as assinaturas do CI com a chave pública do certificado do code
 * signing, o mesmo que o app embute: RSA PKCS #1 v1.5 com SHA-256
 * (`rsa-v1_5-sha256`), sobre os bytes UTF-8 do texto, como o expo-updates
 * confere no aparelho. O certificado vem de fora (o embutido na produção, um
 * descartável nos testes).
 */
export function createOtaSignatureVerifier(
  certificate: string | X509Certificate,
): OtaSignatureVerifier {
  const parsed =
    typeof certificate === 'string'
      ? new X509Certificate(certificate)
      : certificate;
  const key = parsed.publicKey;
  if (key.asymmetricKeyType !== 'rsa')
    throw new Error(
      'the OTA code signing certificate must have an RSA key (rsa-v1_5-sha256)',
    );

  return {
    verify(data, signature) {
      try {
        return verify(
          'sha256',
          Buffer.from(data, 'utf8'),
          key,
          Buffer.from(signature, 'base64'),
        );
      } catch {
        // uma assinatura de tamanho errado faz o OpenSSL reclamar
        return false;
      }
    },
  };
}
