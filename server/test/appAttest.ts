import { X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type { AppAttestation } from '../src/modules/access/ports.ts';

/*
 * O App Attest de mentira dos testes: a cadeia que o fixtures/appAttest.sh
 * gerou com o OpenSSL (uma raiz e uma intermediária falsas no lugar das da
 * Apple, e um credCert por caso, com o nonce de um clientDataHash fixo) e um
 * escritor de CBOR mínimo, que monta o objeto de atestação como a Apple
 * monta. O escritor não tem nada do leitor do servidor, de propósito.
 */

type CredCert = { keyId: string; authData: string; certificate: string };

export type AppAttestCase =
  | 'valid'
  | 'development'
  | 'otherAaguid'
  | 'counter'
  | 'credentialId'
  | 'withoutNonce'
  | 'impostor';

export const APP_ATTEST = JSON.parse(
  readFileSync(new URL('./fixtures/appAttest.json', import.meta.url), 'utf8'),
) as {
  appId: string;
  clientDataHash: string;
  root: string;
  intermediate: string;
  otherRoot: string;
  /** Uma intermediária da outra raiz, com o mesmo nome da nossa. */
  impostor: string;
  credCerts: Record<AppAttestCase, CredCert>;
};

export const base64 = (value: string) => Buffer.from(value, 'base64');

const certificate = (der: string) => new X509Certificate(base64(der));

/** A raiz de mentira, no lugar da Apple App Attestation Root CA. */
export const FAKE_ROOT = certificate(APP_ATTEST.root);
export const OTHER_ROOT = certificate(APP_ATTEST.otherRoot);
/** O clientDataHash de todos os casos (o SHA-256 de um texto fixo). */
export const CLIENT_DATA_HASH = base64(APP_ATTEST.clientDataHash);

const HOUR = 60 * 60 * 1000;
const validCredCert = certificate(APP_ATTEST.credCerts.valid.certificate);
/** Um instante em que a cadeia vale: uma hora depois da emissão do credCert. */
export const VALID_AT = validCredCert.validFromDate.getTime() + HOUR;
/** Logo depois de o credCert vencer (as autoridades valem mais). */
export const AFTER_CREDCERT = validCredCert.validToDate.getTime() + 1000;

/* ------------------------------------------------------- o escritor de CBOR */

/** Um valor CBOR: bytes, texto, lista, mapa (as entradas na ordem) ou bytes crus. */
export type CborInput =
  | Buffer
  | string
  | CborInput[]
  | { entries: Array<[CborInput, CborInput]> }
  | { raw: Buffer };

export const cborMap = (...entries: Array<[CborInput, CborInput]>) => ({
  entries,
});

/** O cabeçalho: o tipo nos 3 bits de cima e o tamanho, na forma mais curta. */
function head(major: number, length: number): Buffer {
  const type = major * 32;
  if (length < 24) return Buffer.from([type + length]);
  if (length < 0x100) return Buffer.from([type + 24, length]);
  if (length < 0x10000) {
    const bytes = Buffer.from([type + 25, 0, 0]);
    bytes.writeUInt16BE(length, 1);
    return bytes;
  }
  const bytes = Buffer.from([type + 26, 0, 0, 0, 0]);
  bytes.writeUInt32BE(length, 1);
  return bytes;
}

export function cbor(value: CborInput): Buffer {
  if (Buffer.isBuffer(value))
    return Buffer.concat([head(2, value.length), value]);
  if (typeof value === 'string') {
    const text = Buffer.from(value, 'utf8');
    return Buffer.concat([head(3, text.length), text]);
  }
  if (Array.isArray(value))
    return Buffer.concat([head(4, value.length), ...value.map(cbor)]);
  if ('raw' in value) return value.raw;
  return Buffer.concat([
    head(5, value.entries.length),
    ...value.entries.flatMap(([key, item]) => [cbor(key), cbor(item)]),
  ]);
}

/** O recibo, que o servidor não abre (o da Apple é um PKCS #7 de uns 3 KB). */
const RECEIPT = Buffer.from('recibo de mentira');

/**
 * O objeto de atestação de um caso, como o `attestKey` devolve; as opções
 * trocam uma parte.
 */
export function attestationObject(
  name: AppAttestCase,
  {
    fmt = 'apple-appattest',
    intermediate = APP_ATTEST.intermediate,
    x5c,
    receipt = RECEIPT,
    authData,
  }: {
    fmt?: CborInput;
    /** A intermediária (base64 DER) que vai depois do credCert. */
    intermediate?: string;
    x5c?: CborInput;
    receipt?: CborInput;
    authData?: CborInput;
  } = {},
): Buffer {
  const credCert = APP_ATTEST.credCerts[name];
  return cbor(
    cborMap(
      ['fmt', fmt],
      [
        'attStmt',
        cborMap(
          ['x5c', x5c ?? [base64(credCert.certificate), base64(intermediate)]],
          ['receipt', receipt],
        ),
      ],
      ['authData', authData ?? base64(credCert.authData)],
    ),
  );
}

/** O keyId e o objeto de um caso, como o app manda (já fora do base64). */
export const appAttestation = (
  name: AppAttestCase,
  options?: Parameters<typeof attestationObject>[1],
): AppAttestation => ({
  keyId: base64(APP_ATTEST.credCerts[name].keyId),
  attestation: attestationObject(name, options),
});
