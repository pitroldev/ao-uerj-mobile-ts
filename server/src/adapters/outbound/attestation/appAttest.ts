import { createHash, X509Certificate } from 'node:crypto';

import type {
  AppAttestation,
  AppAttestVerifier,
  Attestation,
} from '../../../modules/access/ports.ts';
import { systemClock, type Clock } from '../../../shared/clock.ts';
import { decodeCbor, isCborBytes, isCborMap, type CborValue } from './cbor.ts';
import { children, DER, DerError, only } from './der.ts';

/*
 * O App Attest do iPhone, conferido aqui mesmo, sem falar com a Apple, como
 * "Validating apps that connect to your server" manda. O app cria uma chave
 * no Secure Enclave (`generateKey`) e pede à Apple que a ateste
 * (`attestKey`) com o `clientDataHash`, que aqui são os 32 bytes do
 * `requestHash` da entrada. A Apple devolve um objeto CBOR:
 *
 *   { fmt: "apple-appattest",
 *     attStmt: { x5c: [credCert, intermediária], receipt },
 *     authData }
 *
 * O credCert é o certificado da chave, emitido pela Apple, e leva na extensão
 * 1.2.840.113635.100.8.2 o SHA-256 do authData com o clientDataHash: é ele
 * que liga a atestação a este pedido. O recibo serve para a métrica de fraude
 * da Apple, que não usamos; nada da atestação fica guardado.
 */

/** O objeto de atestação tem uns 5 KB (os dois certificados e o recibo). */
export const APP_ATTESTATION_MAX_BYTES = 24 * 1024;

/** O keyId é o SHA-256 da chave pública. */
export const APP_ATTEST_KEY_ID_BYTES = 32;

const CLIENT_DATA_HASH_BYTES = 32;

const FORMAT = 'apple-appattest';

/** 1.2.840.113635.100.8.2 em DER (o conteúdo do OID). */
const NONCE_OID = Buffer.from('2a864886f763640802', 'hex');

/** O `aaguid` do authData na produção: "appattest" e sete bytes zero. */
const AAGUID_PRODUCTION = Buffer.concat([
  Buffer.from('appattest', 'ascii'),
  Buffer.alloc(7),
]);
/** No desenvolvimento (os builds do Xcode, com o entitlement de desenvolvimento). */
const AAGUID_DEVELOPMENT = Buffer.from('appattestdevelop', 'ascii');

/** `development` aceita também as chaves do ambiente de desenvolvimento. */
export type AppAttestEnvironment = 'production' | 'development';

/** O que se espera da atestação. */
export type AppAttestExpectation = {
  /** `<Team ID>.<bundle id>`, como o Apple Developer mostra. */
  appId: string;
  /** A raiz fixada: a da Apple (`appleRoot.ts`); nos testes, uma de mentira. */
  root: X509Certificate;
  environment: AppAttestEnvironment;
  now: number;
};

const sha256 = (...parts: Buffer[]) => {
  const hash = createHash('sha256');
  for (const part of parts) hash.update(part);
  return hash.digest();
};

const untrusted = (reason: string): Attestation => ({
  trusted: false,
  reason,
});

/** O authData (WebAuthn, 6.1) até o credentialId; a chave em COSE, depois, não é usada. */
type AuthenticatorData = {
  rpIdHash: Buffer;
  counter: number;
  aaguid: Buffer;
  credentialId: Buffer;
};

function readAuthenticatorData(authData: Buffer): AuthenticatorData | null {
  // rpIdHash (32), flags (1), counter (4), aaguid (16), o tamanho do
  // credentialId (2) e ele
  if (authData.length < 55) return null;
  const length = authData.readUInt16BE(53);
  if (authData.length < 55 + length) return null;
  return {
    rpIdHash: authData.subarray(0, 32),
    counter: authData.readUInt32BE(33),
    aaguid: authData.subarray(37, 53),
    credentialId: authData.subarray(55, 55 + length),
  };
}

/**
 * O nonce do credCert, da extensão 1.2.840.113635.100.8.2: um
 * SEQUENCE { [1] EXPLICIT OCTET STRING }. `null` sem a extensão; lança
 * `DerError` se ela vier repetida ou fora desse formato.
 */
function nonceOf(certificate: Buffer): Buffer | null {
  // Certificate: SEQUENCE { tbsCertificate, signatureAlgorithm, signature }
  const [tbs] = children(only(certificate, DER.SEQUENCE).content);
  if (tbs?.tag !== DER.SEQUENCE) throw new DerError('no TBSCertificate');
  // as extensões são o [3] EXPLICIT do fim do TBSCertificate
  const wrapper = children(tbs.content).find(
    element => element.tag === DER.CONTEXT_3,
  );
  if (!wrapper) return null;
  let nonce: Buffer | null = null;
  for (const extension of children(
    only(wrapper.content, DER.SEQUENCE).content,
  )) {
    if (extension.tag !== DER.SEQUENCE) throw new DerError('bad extension');
    // Extension: SEQUENCE { extnID, critical BOOLEAN opcional, extnValue }
    const parts = children(extension.content);
    const [id] = parts;
    if (id?.tag !== DER.OID) throw new DerError('bad extension');
    if (!id.content.equals(NONCE_OID)) continue;
    if (nonce) throw new DerError('repeated nonce extension');
    const value = parts.at(-1);
    const shaped =
      (parts.length === 2 ||
        (parts.length === 3 && parts[1]?.tag === DER.BOOLEAN)) &&
      value?.tag === DER.OCTET_STRING;
    if (!shaped || !value) throw new DerError('bad nonce extension');
    const inner = children(only(value.content, DER.SEQUENCE).content);
    const [tagged] = inner;
    if (inner.length !== 1 || tagged?.tag !== DER.CONTEXT_1)
      throw new DerError('bad nonce extension');
    nonce = only(tagged.content, DER.OCTET_STRING).content;
  }
  return nonce;
}

/** O ponto da chave P-256 sem compressão (0x04 ‖ X ‖ Y): o que o keyId resume. */
function publicPoint(certificate: X509Certificate): Buffer | null {
  const key = certificate.publicKey;
  if (
    key.asymmetricKeyType !== 'ec' ||
    key.asymmetricKeyDetails?.namedCurve !== 'prime256v1'
  )
    return null;
  const { x, y } = key.export({ format: 'jwk' });
  if (!x || !y) return null;
  return Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(x, 'base64url'),
    Buffer.from(y, 'base64url'),
  ]);
}

/** `child` foi emitido por `parent`: os nomes (e as chaves, se houver), o uso e a assinatura. */
const issuedBy = (child: X509Certificate, parent: X509Certificate) =>
  child.checkIssued(parent) && child.verify(parent.publicKey);

/**
 * A Apple emite o credCert na hora da atestação (e ele vale poucos dias): um
 * relógio nosso um pouco atrasado não recusa um recém-emitido.
 */
const CLOCK_SKEW_MS = 60 * 1000;

const validAt = (certificate: X509Certificate, now: number) =>
  certificate.validFromDate.getTime() - CLOCK_SKEW_MS <= now &&
  now <= certificate.validToDate.getTime();

/** Um certificado em DER, e só ele (o Node também leria um PEM). */
function certificateOf(der: Buffer): X509Certificate | null {
  try {
    const certificate = new X509Certificate(der);
    return certificate.raw.equals(der) ? certificate : null;
  } catch {
    return null;
  }
}

/**
 * Os passos da Apple, na ordem dela. O motivo da recusa vai para o log e não
 * identifica ninguém.
 */
export function judgeAppAttestation(
  { keyId, attestation }: AppAttestation,
  clientDataHash: Buffer,
  expected: AppAttestExpectation,
): Attestation {
  if (keyId.length !== APP_ATTEST_KEY_ID_BYTES) return untrusted('key_id');
  if (clientDataHash.length !== CLIENT_DATA_HASH_BYTES)
    return untrusted('client_data_hash');
  if (attestation.length > APP_ATTESTATION_MAX_BYTES)
    return untrusted('malformed_attestation');

  let decoded: CborValue;
  try {
    decoded = decodeCbor(attestation);
  } catch {
    return untrusted('malformed_attestation');
  }
  if (!isCborMap(decoded)) return untrusted('malformed_attestation');
  if (decoded.get('fmt') !== FORMAT) return untrusted('attestation_format');
  const statement = decoded.get('attStmt');
  const authData = decoded.get('authData');
  if (!isCborMap(statement) || !isCborBytes(authData))
    return untrusted('malformed_attestation');
  const x5c = statement.get('x5c');
  if (
    !Array.isArray(x5c) ||
    x5c.length !== 2 ||
    !x5c.every(isCborBytes) ||
    !isCborBytes(statement.get('receipt'))
  )
    return untrusted('malformed_attestation');

  // 1. a cadeia: o credCert, emitido pela intermediária, emitida pela raiz
  // fixada, todos valendo agora
  const [credCert, intermediate] = x5c.map(certificateOf);
  if (!credCert || !intermediate) return untrusted('malformed_certificate');
  let chained: boolean;
  try {
    chained =
      intermediate.ca &&
      issuedBy(credCert, intermediate) &&
      issuedBy(intermediate, expected.root);
  } catch {
    chained = false;
  }
  if (!chained) return untrusted('certificate_chain');
  if (
    ![credCert, intermediate, expected.root].every(c =>
      validAt(c, expected.now),
    )
  )
    return untrusted('certificate_expired');

  const data = readAuthenticatorData(authData);
  if (!data) return untrusted('malformed_auth_data');

  // 2 a 4. o nonce: SHA-256(authData ‖ clientDataHash), o que o credCert traz
  let certified: Buffer | null;
  try {
    certified = nonceOf(credCert.raw);
  } catch {
    return untrusted('malformed_certificate');
  }
  if (!certified) return untrusted('nonce_missing');
  if (!certified.equals(sha256(authData, clientDataHash)))
    return untrusted('nonce');

  // 5. a chave do credCert é a do keyId
  const point = publicPoint(credCert);
  if (!point || !sha256(point).equals(keyId)) return untrusted('key_id');

  // 6. o app: o rpIdHash é o SHA-256 do App ID
  if (!data.rpIdHash.equals(sha256(Buffer.from(expected.appId, 'utf8'))))
    return untrusted('app_id');

  // 7. uma chave nova, nunca usada
  if (data.counter !== 0) return untrusted('counter');

  // 8. o ambiente: produção sempre; desenvolvimento, só se configurado
  const production = data.aaguid.equals(AAGUID_PRODUCTION);
  const development = data.aaguid.equals(AAGUID_DEVELOPMENT);
  if (!production && !(development && expected.environment === 'development'))
    return untrusted(development ? 'development_environment' : 'aaguid');

  // 9. a credencial do authData é a mesma chave
  if (!data.credentialId.equals(keyId)) return untrusted('credential_id');

  return { trusted: true };
}

export function createAppAttestVerifier({
  appId,
  root,
  environment = 'production',
  now = systemClock,
}: {
  appId: string;
  root: X509Certificate;
  environment?: AppAttestEnvironment;
  now?: Clock;
}): AppAttestVerifier {
  return {
    async verify(attestation, clientDataHash) {
      try {
        return judgeAppAttestation(attestation, clientDataHash, {
          appId,
          root,
          environment,
          now: now(),
        });
      } catch {
        // nada aqui depende de fora: o que escapou é do objeto recebido
        return untrusted('malformed_attestation');
      }
    },
  };
}
