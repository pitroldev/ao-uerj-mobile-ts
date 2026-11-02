/* oxlint-disable no-bitwise -- a codificação PSS (RFC 8017, 9.1.1) faz o XOR da máscara e zera o bit de cima, como a norma escreve. */
import {
  constants,
  createHash,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
  verify,
  type KeyObject,
  type RSAPSSKeyPairKeyObjectOptions,
} from 'node:crypto';

import {
  challengeDigest,
  encodeChallenge,
  issuerKey,
  signingKey,
  TOKEN_TYPE_BLIND_RSA,
  type IssuerKey,
  type SigningKey,
} from '../src/modules/access/domain.ts';

/** Um par de chaves do emissor para os testes, com a pública como o servidor a usa. */
export type StudentKey = {
  publicKey: KeyObject;
  privateKey: KeyObject;
  issuer: IssuerKey;
};

/**
 * Um par RSA-PSS de 2048 bits. (O @types/node declara `saltLength` como
 * texto; o Node espera o número de bytes.)
 */
export const rsaPssKeyPair = (hash = 'sha384', saltLength = 48) =>
  generateKeyPairSync('rsa-pss', {
    modulusLength: 2048,
    hashAlgorithm: hash,
    mgf1HashAlgorithm: hash,
    saltLength,
  } as unknown as RSAPSSKeyPairKeyObjectOptions);

export function studentKeys(
  count: number,
  notAfter = new Date(Date.UTC(2100, 0, 1)),
): StudentKey[] {
  return Array.from({ length: count }, () => {
    const { publicKey, privateKey } = rsaPssKeyPair();
    return {
      publicKey,
      privateKey,
      issuer: issuerKey(
        publicKey.export({ type: 'spki', format: 'der' }),
        notAfter,
      ),
    };
  });
}

/** Chaves que assinam (RSA comum, PKCS #8), como a emissão as usa. */
export function signingKeys(
  count: number,
  notAfter = new Date(Date.UTC(2100, 0, 1)),
): SigningKey[] {
  return Array.from({ length: count }, () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    return signingKey(
      privateKey.export({ type: 'pkcs8', format: 'der' }),
      notAfter,
    );
  });
}

/** A entrada de `PRIVATE_TOKEN_KEYS` de uma chave que assina. */
export const privateKeyEntry = (key: SigningKey, date = '2100-01-01') =>
  `${key.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')}@${date}`;

/** Base64url com o `=` do fim, como a RFC 9577 pede. */
export const base64urlPadded = (bytes: Buffer) =>
  bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

/**
 * O cabeçalho `Authorization` de um token assinado direto com a chave
 * privada, sem a emissão: o Blind RSA, já sem o fator cego, dá a mesma
 * assinatura RSA-PSS.
 */
export function mintToken(
  key: StudentKey,
  {
    issuer = 'pitrol.dev',
    origin = issuer,
    signer = key.privateKey,
  }: { issuer?: string; origin?: string; signer?: KeyObject } = {},
): string {
  const challenge = encodeChallenge({
    issuer,
    redemptionContext: Buffer.alloc(0),
    origins: [origin],
  });
  const type = Buffer.alloc(2);
  type.writeUInt16BE(TOKEN_TYPE_BLIND_RSA);
  const input = Buffer.concat([
    type,
    randomBytes(32),
    challengeDigest(challenge),
    key.issuer.id,
  ]);
  const authenticator = sign('sha384', input, {
    key: signer,
    padding: constants.RSA_PKCS1_PSS_PADDING,
    saltLength: 48,
  });
  return `PrivateToken token="${base64urlPadded(Buffer.concat([input, authenticator]))}"`;
}

/*
 * O lado do app na emissão (RFC 9474, a variante RSABSSA-SHA384-PSS-
 * Deterministic da RFC 9578): cegar a entrada do token e, com a resposta,
 * tirar o fator cego. Aqui só para os testes, sem cuidado com tempo
 * constante; o vetor da RFC confere cada passo.
 */

const MODULUS_BYTES = 256;
const sha256 = (data: Buffer) => createHash('sha256').update(data).digest();
const sha384 = (data: Buffer) => createHash('sha384').update(data).digest();
const toBigInt = (bytes: Buffer) => BigInt(`0x${bytes.toString('hex')}`);
const toBytes = (value: bigint, length: number) =>
  Buffer.from(value.toString(16).padStart(length * 2, '0'), 'hex');

function modPow(base: bigint, exponent: bigint, modulus: bigint) {
  let result = 1n;
  let square = base % modulus;
  for (let rest = exponent; rest > 0n; rest /= 2n) {
    if (rest % 2n === 1n) result = (result * square) % modulus;
    square = (square * square) % modulus;
  }
  return result;
}

function modInverse(value: bigint, modulus: bigint) {
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
function mgf1(seed: Buffer, length: number) {
  const blocks: Buffer[] = [];
  for (let counter = 0; blocks.length * 48 < length; counter += 1) {
    const c = Buffer.alloc(4);
    c.writeUInt32BE(counter);
    blocks.push(sha384(Buffer.concat([seed, c])));
  }
  return Buffer.concat(blocks).subarray(0, length);
}

/** EMSA-PSS-ENCODE (RFC 8017, 9.1.1) para um módulo de 2048 bits. */
function pssEncode(message: Buffer, salt: Buffer) {
  const hash = sha384(Buffer.concat([Buffer.alloc(8), sha384(message), salt]));
  const db = Buffer.concat([
    Buffer.alloc(MODULUS_BYTES - salt.length - hash.length - 2),
    Buffer.from([1]),
    salt,
  ]);
  const mask = mgf1(hash, db.length);
  const masked = Buffer.from(db.map((byte, index) => byte ^ mask[index]));
  masked[0] &= 0x7f;
  return Buffer.concat([masked, hash, Buffer.from([0xbc])]);
}

/** O pedido cego de um token e como terminá-lo com a resposta do emissor. */
export type BlindedToken = {
  /** O TokenRequest (RFC 9578, 6.1) que vai para o emissor. */
  tokenRequest: Buffer;
  /** O token pronto (a assinatura conferida), a partir da assinatura cega. */
  finalize(tokenResponse: Buffer): Buffer;
};

export function blindToken(
  tokenKey: Buffer,
  {
    challenge = encodeChallenge({
      issuer: 'pitrol.dev',
      redemptionContext: Buffer.alloc(0),
      origins: ['pitrol.dev'],
    }),
    nonce = randomBytes(32),
    salt = randomBytes(48),
    blind,
  }: {
    challenge?: Buffer;
    nonce?: Buffer;
    salt?: Buffer;
    /** O `r` da RFC 9474; sem ele, um ao acaso. */
    blind?: bigint;
  } = {},
): BlindedToken {
  const rsaPublicKey = tokenKey.subarray(tokenKey.length - 270);
  const n = toBigInt(rsaPublicKey.subarray(9, 9 + MODULUS_BYTES));
  const e = toBigInt(rsaPublicKey.subarray(rsaPublicKey.length - 3));
  const keyId = sha256(tokenKey);
  const type = Buffer.alloc(2);
  type.writeUInt16BE(TOKEN_TYPE_BLIND_RSA);
  const input = Buffer.concat([type, nonce, challengeDigest(challenge), keyId]);

  const m = toBigInt(pssEncode(input, salt));
  const r = blind ?? (toBigInt(randomBytes(MODULUS_BYTES)) % (n - 1n)) + 1n;
  const inverse = modInverse(r, n);
  const blinded = (m * modPow(r, e, n)) % n;
  const tokenRequest = Buffer.concat([
    type,
    keyId.subarray(keyId.length - 1),
    toBytes(blinded, MODULUS_BYTES),
  ]);

  return {
    tokenRequest,
    finalize(tokenResponse) {
      const signature = toBytes(
        (toBigInt(tokenResponse) * inverse) % n,
        MODULUS_BYTES,
      );
      const valid = verify(
        'sha384',
        input,
        {
          key: createPublicKey({ key: tokenKey, format: 'der', type: 'spki' }),
          padding: constants.RSA_PKCS1_PSS_PADDING,
          saltLength: 48,
        },
        signature,
      );
      if (!valid) throw new Error('the blind signature does not verify');
      return Buffer.concat([input, signature]);
    },
  };
}

/** O cabeçalho `Authorization` de um token. */
export const authorization = (token: Buffer) =>
  `PrivateToken token="${base64urlPadded(token)}"`;
