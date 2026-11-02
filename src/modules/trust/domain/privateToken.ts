/* oxlint-disable no-bitwise -- a codificação PSS (RFC 8017, 9.1.1 e 9.1.2) faz o XOR da máscara e testa e zera o bit de cima, como a norma escreve. */
import {
  ascii,
  bigIntToBytes,
  bytesToBigInt,
  concat,
  equalBytes,
  fromHex,
  toBase64,
  toHex,
  u16,
  u32,
} from './bytes';

/*
 * Os tokens anônimos de aluno (Privacy Pass, RFC 9577 e 9578), do lado do
 * app: o Blind RSA de 2048 bits, o tipo 0x0002 (a variante
 * RSABSSA-SHA384-PSS-Deterministic da RFC 9474). O app cega a entrada do
 * token, o servidor assina sem ver o que assina, e o app tira o fator cego. O
 * token que sai daí não se liga à emissão. O par do servidor está em
 * server/src/modules/access/domain.ts.
 */

/** O hash e a aleatoriedade da plataforma; o protocolo não traz criptografia própria. */
export type TokenCrypto = {
  sha256(data: Uint8Array): Uint8Array;
  sha384(data: Uint8Array): Uint8Array;
  randomBytes(length: number): Uint8Array;
};

/** Blind RSA de 2048 bits (RFC 9578, 6). */
const TOKEN_TYPE = 0x0002;
const NONCE_BYTES = 32;
const DIGEST_BYTES = 32;
const KEY_ID_BYTES = 32;
const MODULUS_BYTES = 256;
/** SHA-384, o hash do PSS. */
const HASH_BYTES = 48;
const SALT_BYTES = 48;
const INPUT_BYTES = 2 + NONCE_BYTES + DIGEST_BYTES + KEY_ID_BYTES;
/** Tipo, nonce, digest do desafio, id da chave e a assinatura. */
export const TOKEN_BYTES = INPUT_BYTES + MODULUS_BYTES;

/**
 * O emissor e a origem dos tokens. Com o `redemption_context` vazio, o
 * desafio é sempre o mesmo, e o app pode buscar tokens com antecedência.
 */
const ISSUER_NAME = 'pitrol.dev';

/**
 * O SPKI de uma chave RSA-PSS de 2048 bits como a RFC 9578 (6.5) o escreve,
 * até o BIT STRING (SHA-384, MGF1 com SHA-384 e sal de 48), e o começo e o
 * fim do RSAPublicKey (n de 2048 bits, e = 65537). O app só aceita esta forma:
 * o id da chave é o SHA-256 destes bytes.
 */
const SPKI_PREFIX = fromHex(
  '30820152303d06092a864886f70d01010a3030a00d300b0609608648016503040202a11a301806092a864886f70d010108300b0609608648016503040202a2030201300382010f00',
);
const RSA_PUBLIC_KEY_START = fromHex('3082010a0282010100');
const RSA_PUBLIC_EXPONENT = fromHex('0203010001');
const TOKEN_KEY_BYTES =
  SPKI_PREFIX.length +
  RSA_PUBLIC_KEY_START.length +
  MODULUS_BYTES +
  RSA_PUBLIC_EXPONENT.length;

/** A chave pública do emissor, lida do `tokenKey` do desafio. */
export type TokenKey = {
  /** `token_key_id`: o SHA-256 do SPKI. */
  id: Uint8Array;
  n: bigint;
  e: bigint;
};

/** A chave do emissor; `null` fora da forma da RFC 9578 ou de 2048 bits. */
export function parseTokenKey(
  crypto: TokenCrypto,
  spki: Uint8Array,
): TokenKey | null {
  if (spki.length !== TOKEN_KEY_BYTES) return null;
  const rsa = spki.subarray(SPKI_PREFIX.length);
  const modulus = rsa.subarray(
    RSA_PUBLIC_KEY_START.length,
    RSA_PUBLIC_KEY_START.length + MODULUS_BYTES,
  );
  if (
    !equalBytes(spki.subarray(0, SPKI_PREFIX.length), SPKI_PREFIX) ||
    !equalBytes(
      rsa.subarray(0, RSA_PUBLIC_KEY_START.length),
      RSA_PUBLIC_KEY_START,
    ) ||
    !equalBytes(
      rsa.subarray(RSA_PUBLIC_KEY_START.length + MODULUS_BYTES),
      RSA_PUBLIC_EXPONENT,
    ) ||
    // um módulo de 2048 bits tem o bit de cima ligado
    modulus[0] < 0x80
  )
    return null;
  return {
    id: crypto.sha256(spki),
    n: bytesToBigInt(modulus),
    e: bytesToBigInt(RSA_PUBLIC_EXPONENT.subarray(2)),
  };
}

/** O TokenChallenge (RFC 9577, 2.1) que os tokens do app assinam. */
export function encodeChallenge(
  issuer = ISSUER_NAME,
  origin = ISSUER_NAME,
): Uint8Array {
  const issuerName = ascii(issuer);
  const originInfo = ascii(origin);
  return concat(
    u16(TOKEN_TYPE),
    u16(issuerName.length),
    issuerName,
    // redemption_context vazio
    Uint8Array.of(0),
    u16(originInfo.length),
    originInfo,
  );
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  let square = base % modulus;
  for (let rest = exponent; rest > 0n; rest /= 2n) {
    if (rest % 2n === 1n) result = (result * square) % modulus;
    square = (square * square) % modulus;
  }
  return result;
}

function modInverse(value: bigint, modulus: bigint): bigint {
  let [a, b] = [value % modulus, modulus];
  let [x, y] = [1n, 0n];
  while (b !== 0n) {
    const quotient = a / b;
    [a, b] = [b, a - quotient * b];
    [x, y] = [y, x - quotient * y];
  }
  if (a !== 1n) throw new RangeError('not invertible');
  return ((x % modulus) + modulus) % modulus;
}

/** MGF1 com SHA-384 (RFC 8017, B.2.1). */
function mgf1(crypto: TokenCrypto, seed: Uint8Array, length: number) {
  const out = new Uint8Array(length);
  for (let counter = 0; counter * HASH_BYTES < length; counter++) {
    const block = crypto.sha384(concat(seed, u32(counter)));
    const offset = counter * HASH_BYTES;
    out.set(block.subarray(0, Math.min(HASH_BYTES, length - offset)), offset);
  }
  return out;
}

/** O `H` do PSS: SHA-384 de oito zeros, do hash da mensagem e do sal. */
const pssHash = (crypto: TokenCrypto, message: Uint8Array, salt: Uint8Array) =>
  crypto.sha384(concat(new Uint8Array(8), crypto.sha384(message), salt));

/** O DB do PSS: zeros, 0x01 e o sal, antes e depois da máscara. */
const DB_BYTES = MODULUS_BYTES - HASH_BYTES - 1;
const PADDING_BYTES = DB_BYTES - SALT_BYTES - 1;

/** EMSA-PSS-ENCODE (RFC 8017, 9.1.1) para um módulo de 2048 bits. */
function pssEncode(crypto: TokenCrypto, message: Uint8Array, salt: Uint8Array) {
  const hash = pssHash(crypto, message, salt);
  const db = concat(new Uint8Array(PADDING_BYTES), Uint8Array.of(1), salt);
  const mask = mgf1(crypto, hash, DB_BYTES);
  const masked = db.map((byte, index) => byte ^ mask[index]);
  masked[0] &= 0x7f;
  return concat(masked, hash, Uint8Array.of(0xbc));
}

/** EMSA-PSS-VERIFY (RFC 8017, 9.1.2) com sal de 48 bytes. */
function pssVerify(
  crypto: TokenCrypto,
  message: Uint8Array,
  encoded: Uint8Array,
): boolean {
  if (encoded[MODULUS_BYTES - 1] !== 0xbc) return false;
  const masked = encoded.subarray(0, DB_BYTES);
  const hash = encoded.subarray(DB_BYTES, DB_BYTES + HASH_BYTES);
  if ((masked[0] & 0x80) !== 0) return false;
  const mask = mgf1(crypto, hash, DB_BYTES);
  const db = masked.map((byte, index) => byte ^ mask[index]);
  db[0] &= 0x7f;
  for (let i = 0; i < PADDING_BYTES; i++) if (db[i] !== 0) return false;
  if (db[PADDING_BYTES] !== 1) return false;
  return equalBytes(
    hash,
    pssHash(crypto, message, db.subarray(DB_BYTES - SALT_BYTES)),
  );
}

/** Um token cego, à espera da assinatura do emissor. */
export type BlindedToken = {
  /** O TokenRequest (RFC 9578, 6.1): tipo, último byte do id da chave e o pedido cego. */
  request: Uint8Array;
  /** A entrada do token, que a assinatura cobre. */
  input: Uint8Array;
  /** O inverso do fator cego, que tira o fator da assinatura. */
  inverse: bigint;
};

/**
 * Cega a entrada de um token para a chave do emissor (RFC 9474, Blind). O
 * nonce, o sal e o fator cego saem da aleatoriedade da plataforma; os testes
 * os fixam para conferir com o vetor da RFC.
 */
export function blindToken(
  crypto: TokenCrypto,
  key: TokenKey,
  challenge: Uint8Array,
  fixed: { nonce?: Uint8Array; salt?: Uint8Array; blind?: bigint } = {},
): BlindedToken {
  const nonce = fixed.nonce ?? crypto.randomBytes(NONCE_BYTES);
  const salt = fixed.salt ?? crypto.randomBytes(SALT_BYTES);
  const input = concat(
    u16(TOKEN_TYPE),
    nonce,
    crypto.sha256(challenge),
    key.id,
  );
  const encoded = bytesToBigInt(pssEncode(crypto, input, salt));
  const blind =
    fixed.blind ??
    (bytesToBigInt(crypto.randomBytes(MODULUS_BYTES)) % (key.n - 1n)) + 1n;
  const inverse = modInverse(blind, key.n);
  const blinded = (encoded * modPow(blind, key.e, key.n)) % key.n;
  return {
    request: concat(
      u16(TOKEN_TYPE),
      key.id.subarray(KEY_ID_BYTES - 1),
      bigIntToBytes(blinded, MODULUS_BYTES),
    ),
    input,
    inverse,
  };
}

/**
 * Tira o fator cego da assinatura do emissor e confere o resultado (RFC 9474,
 * Finalize). `null` se ela não vale: o token não serviria no resgate.
 */
export function finalizeToken(
  crypto: TokenCrypto,
  key: TokenKey,
  blinded: BlindedToken,
  blindSignature: Uint8Array,
): Uint8Array | null {
  if (blindSignature.length !== MODULUS_BYTES) return null;
  const signed = bytesToBigInt(blindSignature);
  if (signed >= key.n) return null;
  const signature = (signed * blinded.inverse) % key.n;
  const encoded = bigIntToBytes(modPow(signature, key.e, key.n), MODULUS_BYTES);
  if (!pssVerify(crypto, blinded.input, encoded)) return null;
  return concat(blinded.input, bigIntToBytes(signature, MODULUS_BYTES));
}

const ISSUANCE_LABEL = ascii('AO UERJ token issuance v1');

/**
 * O `requestHash` que vai à Play Integrity: o SHA-256, em hex minúsculo, do
 * rótulo, do desafio, da instalação e dos pedidos, nessa ordem. A atestação
 * passa a valer só para este lote.
 */
export function issuanceRequestHash(
  crypto: TokenCrypto,
  {
    challenge,
    installation,
    tokenRequests,
  }: {
    challenge: Uint8Array;
    installation: Uint8Array;
    tokenRequests: readonly Uint8Array[];
  },
): string {
  return toHex(
    crypto.sha256(
      concat(ISSUANCE_LABEL, challenge, installation, ...tokenRequests),
    ),
  );
}

/** O id (hex) da chave que assinou um token; `null` se não for um token. */
export function tokenKeyId(token: Uint8Array): string | null {
  if (token.length !== TOKEN_BYTES) return null;
  const start = 2 + NONCE_BYTES + DIGEST_BYTES;
  return toHex(token.subarray(start, start + KEY_ID_BYTES));
}

/** O cabeçalho `Authorization` de um token (RFC 9577, base64url com o `=`). */
export const authorization = (token: Uint8Array) =>
  `PrivateToken token="${toBase64(token, { url: true })}"`;
