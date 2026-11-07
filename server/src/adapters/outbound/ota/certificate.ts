import { X509Certificate } from 'node:crypto';

/**
 * O certificado do code signing das atualizações pelo ar, o mesmo que o app
 * embute (`expo.updates.codeSigningCertificate`). A cópia canônica é
 * `config/ota/certificate.pem`, na raiz do repositório; a implantação só leva
 * `server/` e `deploy/`, então ele vive aqui também, e o `ota.test.ts`
 * confere que os dois são iguais. Trocar a chave é trocar os dois (e a
 * impressão abaixo), e os apps já instalados só aceitam a chave antiga.
 *
 * "AO UERJ", autoassinado, RSA de 2048 bits, uso "Code Signing"; vale de
 * 06/11/2026 a 06/11/2036. `null` desliga as publicações (503).
 */
export const OTA_CODE_SIGNING_CERTIFICATE: string | null =
  `-----BEGIN CERTIFICATE-----
MIIC0TCCAbmgAwIBAgIJNMOruC0DnSkUMA0GCSqGSIb3DQEBCwUAMBIxEDAOBgNV
BAMTB0FPIFVFUkowHhcNMjYxMTA2MjMxNTU2WhcNMzYxMTA2MjMxNTU2WjASMRAw
DgYDVQQDEwdBTyBVRVJKMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA
tQdk2HVpEFb1kvDlOSjSg91X8Cm6zEbEp2M3vG2tuxlIPjxSezUEQwIDVTKTzrJR
FUsU9tL1Ramir8mKCDQecW8O5GDeuJmgTHlHndeFRB1RHUaVwREu0k6pQ4CC1ydT
lJbP4rT5HUd/ThGTk6W/vfZzjmko/Ri+ywgnCVDF2oYa6ZWSuYitEBvJRSmdHhrK
53Yqrh7wYgnNNfBvIjga7Kp7RqFU68bkld+TMbJAPsYG1LOOoSu+i0RfVQp6ZNdq
UA9tfIQY9J53AB2j5YzfNcrFVc4Ifw0283c2ISQBTg1jQiPfax2ZNpQ+bDGi2zWD
ysI051ML8LwvdEPuo1TfowIDAQABoyowKDAOBgNVHQ8BAf8EBAMCB4AwFgYDVR0l
AQH/BAwwCgYIKwYBBQUHAwMwDQYJKoZIhvcNAQELBQADggEBAK7Qqg1CbksjyLAo
8mu+UuuPxmekitfEZpUGj3XbK2aZqx2sdeRBvCBQSXTdZPnz0XHogyPrInJC0LN3
B8VtM4n3v4Pe+Mc2777jc4zJAlTZVKqXF33wsb/XIIERPzF2PNY7hpc1V1eWiMuw
wl2zuVLfcumtxR0wr1+oDytPO611+UESxHGWBF4EwoiolE3ijnKjrsvh5wEIL1Lz
COrInUznrTbEdkctSQyTLWI1Wlb9HfoGWQ4+vNQQxlCUfgRTIWG2qARjRMf31DgA
Pca3NxucWdnUe2JU9lvHk0gc7FlGCguChS+rWZuf/LP4B2D1QiM8FRZpVGY0MdJ1
Jhm7Mjo=
-----END CERTIFICATE-----
`;

/** A impressão SHA-256 (DER) do certificado acima, conferida a cada leitura. */
export const OTA_CODE_SIGNING_CERTIFICATE_SHA256: string | null =
  '7C:8A:FD:A2:67:70:EE:3B:51:A4:3E:70:5A:55:E8:FF:E0:1F:C6:D8:09:38:A3:72:8D:BF:0E:53:E5:5B:11:FF';

/**
 * A assinatura (base64) da diretiva `{"type":"noUpdateAvailable"}`, a
 * resposta de "nada novo". O servidor não tem a chave privada, e a RSA
 * PKCS #1 v1.5 dá sempre a mesma assinatura para o mesmo texto: quem tem a
 * chave a faz uma vez e cola aqui,
 *
 *   printf '%s' '{"type":"noUpdateAvailable"}' |
 *     openssl dgst -sha256 -sign private-key.pem | openssl base64 -A
 *
 * e a partida a confere com o certificado (uma errada não deixa subir).
 * Enquanto for `null`, "nada novo" é um 204 sem corpo: o expo-updates o
 * trata do mesmo jeito, e não há o que assinar.
 */
export const OTA_NO_UPDATE_AVAILABLE_SIGNATURE: string | null =
  'Fwz1kXrYJh05HM/cpUvzhEpTJVs7NIQQDaC7qoVm/fHQR8EGTxGb0QY2GNRvwFy9cm0U8Hzg5+//6yqs5u/jBYvVPGeiog6fTOTPCZuOtnTlKzLbwHEynDhkUdqccnUsmFsR7jxTOlGCJ8DdTnWw8hzi38ZcqJZ+PMU4t8eS14s6bm6PGS4LgV4zHzpOUkXzU1Klj7lJDFYei//jsT0Ow0lWvI6EaeoHngdbMlRXSDU1M25OY3TPdksBNRiwTniFUGQu7DvhMcFMQ5plKYPyOK+o/62xesBR0erVUNC/Vn1i5l13TX1bvwsiQJ1zdOofEQeRgrlbW2LaOVeN9Gvdug==';

/**
 * O certificado, conferido pela impressão: um certificado mexido (uma edição
 * sem querer) não deixa o servidor subir. `null` sem certificado.
 */
export function otaCodeSigningCertificate(
  pem: string | null = OTA_CODE_SIGNING_CERTIFICATE,
  fingerprint: string | null = OTA_CODE_SIGNING_CERTIFICATE_SHA256,
): X509Certificate | null {
  if (pem === null) return null;
  const certificate = new X509Certificate(pem);
  if (certificate.fingerprint256 !== fingerprint)
    throw new Error('the embedded OTA code signing certificate was changed');
  return certificate;
}
