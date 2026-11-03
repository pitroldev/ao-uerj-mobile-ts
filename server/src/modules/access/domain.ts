import {
  constants,
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  hkdfSync,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
  timingSafeEqual,
  verify,
  type KeyObject,
} from 'node:crypto';

/*
 * O acesso de aluno da API v2, pelo Privacy Pass (RFC 9576, 9577 e 9578): o
 * app prova que recebeu um token do emissor sem dizer quem é, e o servidor
 * não consegue ligar o token a quem o pediu. Aqui ficam o resgate (o
 * desafio, o formato do token e a verificação da assinatura) e a emissão (o
 * pedido cego e a assinatura cega), no Blind RSA de 2048 bits, o tipo 0x0002.
 */

/** Blind RSA de 2048 bits (RFC 9578, 6). */
export const TOKEN_TYPE_BLIND_RSA = 0x0002;

const NONCE_BYTES = 32;
const DIGEST_BYTES = 32;
const KEY_ID_BYTES = 32;
/** O `Nk` do tipo 0x0002: a assinatura tem o tamanho do módulo. */
const AUTHENTICATOR_BYTES = 256;
const INPUT_BYTES = 2 + NONCE_BYTES + DIGEST_BYTES + KEY_ID_BYTES;
export const TOKEN_BYTES = INPUT_BYTES + AUTHENTICATOR_BYTES;
/** O TokenRequest (RFC 9578, 6.1): tipo, último byte do id da chave e o pedido cego. */
export const TOKEN_REQUEST_BYTES = 2 + 1 + AUTHENTICATOR_BYTES;

const sha256 = (data: Buffer) => createHash('sha256').update(data).digest();
const hmac = (key: Buffer, data: Buffer) =>
  createHmac('sha256', key).update(data).digest();

const uint16 = (value: number) => {
  const out = Buffer.alloc(2);
  out.writeUInt16BE(value);
  return out;
};

/** O TokenChallenge (RFC 9577, 2.1) que o servidor manda e o token assina. */
export type TokenChallenge = {
  issuer: string;
  /** 0 ou 32 bytes; vazio deixa o app buscar tokens com antecedência. */
  redemptionContext: Buffer;
  /** As origens em que o token vale; nenhuma, em qualquer uma. */
  origins: readonly string[];
};

export function encodeChallenge({
  issuer,
  redemptionContext,
  origins,
}: TokenChallenge): Buffer {
  if (redemptionContext.length !== 0 && redemptionContext.length !== 32)
    throw new RangeError('redemption_context must have 0 or 32 bytes');
  const issuerName = Buffer.from(issuer, 'ascii');
  const originInfo = Buffer.from(origins.join(','), 'ascii');
  return Buffer.concat([
    uint16(TOKEN_TYPE_BLIND_RSA),
    uint16(issuerName.length),
    issuerName,
    Buffer.from([redemptionContext.length]),
    redemptionContext,
    uint16(originInfo.length),
    originInfo,
  ]);
}

/** O `challenge_digest` que o token carrega. */
export const challengeDigest = (challenge: Buffer) => sha256(challenge);

/**
 * O SPKI de uma chave RSA-PSS de 2048 bits como a RFC 9578 (6.5) o escreve,
 * até o BIT STRING: SHA-384, MGF1 com SHA-384 e sal de 48, sem o NULL que o
 * OpenSSL põe nos parâmetros do hash. O id da chave é o SHA-256 destes bytes,
 * então emissor e app precisam da mesma forma.
 */
const SPKI_PREFIX = Buffer.from(
  '30820152303d06092a864886f70d01010a3030a00d300b0609608648016503040202a11a301806092a864886f70d010108300b0609608648016503040202a2030201300382010f00',
  'hex',
);
/** O RSAPublicKey de 2048 bits com o expoente 65537: cabeçalho, n e e. */
const RSA_PUBLIC_KEY_BYTES = 270;
const RSA_PUBLIC_KEY_START = Buffer.from('3082010a0282010100', 'hex');
const MODULUS_BYTES = 256;

/** Uma chave pública do emissor, com o id e a validade. */
export type IssuerKey = {
  /** `token_key_id`: o SHA-256 do SPKI na forma da RFC. */
  id: Buffer;
  /** O SPKI na forma da RFC: o que o app recebe em `token-key`. */
  spki: Buffer;
  key: KeyObject;
  /** Depois disto, os tokens desta chave não valem mais. */
  notAfter: Date;
};

/** O RSAPublicKey (n, e) do fim do SPKI de uma chave de 2048 bits. */
function rsaPublicKeyOf(key: KeyObject): Buffer {
  const exported = key.export({ type: 'spki', format: 'der' });
  const rsaPublicKey = exported.subarray(
    exported.length - RSA_PUBLIC_KEY_BYTES,
  );
  if (
    !rsaPublicKey
      .subarray(0, RSA_PUBLIC_KEY_START.length)
      .equals(RSA_PUBLIC_KEY_START)
  )
    throw new Error('unexpected RSA public key encoding');
  return rsaPublicKey;
}

/** A chave na forma da RFC, a partir do RSAPublicKey. */
function canonicalKey(rsaPublicKey: Buffer, notAfter: Date): IssuerKey {
  const spki = Buffer.concat([SPKI_PREFIX, rsaPublicKey]);
  return {
    id: sha256(spki),
    spki,
    key: createPublicKey({ key: spki, format: 'der', type: 'spki' }),
    notAfter,
  };
}

/**
 * Uma chave pública de 2048 bits com o expoente 65537: a RSA comum (o que o
 * `openssl pkey -pubout` dá da privada) ou a RSA-PSS com os parâmetros do
 * tipo 0x0002 (SHA-384, MGF1 com SHA-384, sal de 48). As duas viram a forma
 * da RFC.
 */
export function issuerKey(spki: Buffer, notAfter: Date): IssuerKey {
  const key = createPublicKey({ key: spki, format: 'der', type: 'spki' });
  const details = key.asymmetricKeyDetails ?? {};
  const pssFits =
    details.hashAlgorithm === 'sha384' &&
    details.mgf1HashAlgorithm === 'sha384' &&
    details.saltLength === 48;
  if (
    !(
      key.asymmetricKeyType === 'rsa' ||
      (key.asymmetricKeyType === 'rsa-pss' && pssFits)
    ) ||
    details.modulusLength !== 2048 ||
    details.publicExponent !== 65537n
  )
    throw new Error(
      'the token key must be RSA with 2048 bits and exponent 65537 (as RSA-PSS, only with SHA-384, MGF1 with SHA-384 and a 48-byte salt)',
    );
  return canonicalKey(rsaPublicKeyOf(key), notAfter);
}

/** Uma chave do emissor com a parte privada: a que assina os lotes. */
export type SigningKey = IssuerKey & {
  privateKey: KeyObject;
  /** O módulo `n`: um pedido cego tem de ser menor que ele. */
  modulus: Buffer;
};

/**
 * Uma chave privada RSA comum (rsaEncryption, PKCS #8) de 2048 bits. A
 * assinatura cega é a operação RSA crua, que o OpenSSL não faz com uma chave
 * RSA-PSS; a pública sai dela na forma RSA-PSS da RFC.
 */
export function signingKey(pkcs8: Buffer, notAfter: Date): SigningKey {
  const privateKey = createPrivateKey({
    key: pkcs8,
    format: 'der',
    type: 'pkcs8',
  });
  const details = privateKey.asymmetricKeyDetails ?? {};
  if (
    privateKey.asymmetricKeyType !== 'rsa' ||
    details.modulusLength !== 2048 ||
    details.publicExponent !== 65537n
  )
    throw new Error(
      'the private token key must be a plain RSA key (rsaEncryption) with 2048 bits and exponent 65537',
    );
  const rsaPublicKey = rsaPublicKeyOf(createPublicKey(privateKey));
  return {
    ...canonicalKey(rsaPublicKey, notAfter),
    privateKey,
    modulus: rsaPublicKey.subarray(
      RSA_PUBLIC_KEY_START.length,
      RSA_PUBLIC_KEY_START.length + MODULUS_BYTES,
    ),
  };
}

export const isSigningKey = (key: IssuerKey): key is SigningKey =>
  'privateKey' in key;

/** O Token (RFC 9577, 2.2), já separado. */
export type Token = {
  nonce: Buffer;
  challengeDigest: Buffer;
  keyId: Buffer;
  authenticator: Buffer;
  /** O que a assinatura cobre: tipo, nonce, digest do desafio e id da chave. */
  input: Buffer;
};

/** O token, ou `null` se ele não tiver o tamanho e o tipo do Blind RSA. */
export function parseToken(bytes: Buffer): Token | null {
  if (
    bytes.length !== TOKEN_BYTES ||
    bytes.readUInt16BE(0) !== TOKEN_TYPE_BLIND_RSA
  )
    return null;
  const at = (start: number, length: number) =>
    bytes.subarray(start, start + length);
  return {
    nonce: at(2, NONCE_BYTES),
    challengeDigest: at(2 + NONCE_BYTES, DIGEST_BYTES),
    keyId: at(2 + NONCE_BYTES + DIGEST_BYTES, KEY_ID_BYTES),
    authenticator: bytes.subarray(INPUT_BYTES),
    input: bytes.subarray(0, INPUT_BYTES),
  };
}

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/**
 * Os bytes do `Authorization: PrivateToken token="…"` (RFC 9577, 2.2.2): o
 * valor com ou sem aspas e com ou sem o `=` do fim; os outros parâmetros
 * são ignorados. `null` se não houver um token legível.
 */
export function tokenFromAuthorization(header: string): Buffer | null {
  const match = /^PrivateToken\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  for (const parameter of match[1].split(',')) {
    const at = parameter.indexOf('=');
    if (at === -1 || parameter.slice(0, at).trim().toLowerCase() !== 'token')
      continue;
    let value = parameter.slice(at + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"'))
      value = value.slice(1, -1);
    return BASE64URL.test(value) ? Buffer.from(value, 'base64url') : null;
  }
  return null;
}

/** Por que um token não vale (só para o log; a resposta é a mesma). */
export type Rejection =
  | 'missing'
  | 'malformed'
  | 'wrong_challenge'
  | 'unknown_key'
  | 'expired_key'
  | 'bad_signature'
  | 'spent';

/**
 * Confere o desafio, a chave e a assinatura (RSASSA-PSS com SHA-384, MGF1
 * com SHA-384 e sal de 48; RFC 9578, 6.4). Não sabe se o token já foi gasto.
 */
export function verifyToken(
  token: Token,
  {
    digest,
    keys,
    now,
  }: { digest: Buffer; keys: readonly IssuerKey[]; now: Date },
): { key: IssuerKey } | { rejected: Rejection } {
  if (!token.challengeDigest.equals(digest))
    return { rejected: 'wrong_challenge' };
  const key = keys.find(candidate => candidate.id.equals(token.keyId));
  if (!key) return { rejected: 'unknown_key' };
  if (key.notAfter.getTime() <= now.getTime())
    return { rejected: 'expired_key' };
  let valid = false;
  try {
    valid = verify(
      'sha384',
      token.input,
      {
        key: key.key,
        padding: constants.RSA_PKCS1_PSS_PADDING,
        saltLength: 48,
      },
      token.authenticator,
    );
  } catch {
    valid = false;
  }
  return valid ? { key } : { rejected: 'bad_signature' };
}

/**
 * O que fica guardado de um token gasto: o hash da chave e do nonce. Não diz
 * nada sobre quem o gastou, e não dá para refazer o token a partir dele.
 */
export const spentId = (token: Token) =>
  sha256(Buffer.concat([token.keyId, token.nonce])).toString('hex');

/** O pedido cego de um token (RFC 9578, 6.1), já separado. */
export type TokenRequest = { truncatedKeyId: number; blindedMsg: Buffer };

/** O pedido, ou `null` se ele não tiver o tamanho e o tipo do Blind RSA. */
export function parseTokenRequest(bytes: Buffer): TokenRequest | null {
  if (
    bytes.length !== TOKEN_REQUEST_BYTES ||
    bytes.readUInt16BE(0) !== TOKEN_TYPE_BLIND_RSA
  )
    return null;
  return { truncatedKeyId: bytes[2], blindedMsg: bytes.subarray(3) };
}

/**
 * O pedido é para esta chave (o último byte do id confere) e cabe no módulo
 * (RFC 9578, 6.2; RFC 9474, 4.3).
 */
export const requestFitsKey = (key: SigningKey, request: TokenRequest) =>
  request.truncatedKeyId === key.id[key.id.length - 1] &&
  Buffer.compare(request.blindedMsg, key.modulus) < 0;

/**
 * BlindSign (RFC 9474, 4.3): a operação RSA crua sobre o pedido cego. O
 * emissor não vê o token que sai dela. O resultado é conferido com a chave
 * pública, como a RFC pede: um erro de cálculo vazaria a chave privada.
 */
export function blindSign(key: SigningKey, request: TokenRequest): Buffer {
  if (!requestFitsKey(key, request))
    throw new RangeError('the token request does not fit this key');
  const blindSig = privateDecrypt(
    { key: key.privateKey, padding: constants.RSA_NO_PADDING },
    request.blindedMsg,
  );
  const back = publicEncrypt(
    { key: key.privateKey, padding: constants.RSA_NO_PADDING },
    blindSig,
  );
  if (!back.equals(request.blindedMsg))
    throw new Error('the blind signature failed its check');
  return blindSig;
}

/** Os segredos da emissão, derivados da chave privada (HKDF): mudam com ela. */
export type IssuanceSecrets = {
  /** Autentica o desafio de emissão, que não fica guardado. */
  challenge: Buffer;
  /** Esconde a instalação no contador de lotes. */
  installation: Buffer;
  /** Autentica o passe de aluno, que também não fica guardado. */
  pass: Buffer;
};

export function issuanceSecrets(key: SigningKey): IssuanceSecrets {
  const material = key.privateKey.export({ type: 'pkcs8', format: 'der' });
  const derive = (info: string) =>
    Buffer.from(hkdfSync('sha256', material, Buffer.alloc(0), info, 32));
  return {
    challenge: derive('ao-uerj v2 issuance challenge'),
    installation: derive('ao-uerj v2 installation counter'),
    pass: derive('ao-uerj v2 student pass'),
  };
}

/** O desafio de emissão: a validade (u32, segundos), 16 bytes ao acaso e 16 de HMAC. */
export const ISSUANCE_CHALLENGE_BYTES = 4 + 16 + 16;

/**
 * Um desafio de emissão que vale até `expiresAt` (arredondado ao segundo). O
 * servidor não o guarda: o HMAC prova que foi ele quem o deu.
 */
export function issuanceChallenge(
  secret: Buffer,
  expiresAt: Date,
  random: Buffer = randomBytes(16),
): { challenge: Buffer; expiresAt: Date } {
  const seconds = Math.floor(expiresAt.getTime() / 1000);
  const head = Buffer.alloc(4);
  head.writeUInt32BE(seconds);
  const body = Buffer.concat([head, random]);
  return {
    challenge: Buffer.concat([body, hmac(secret, body).subarray(0, 16)]),
    expiresAt: new Date(seconds * 1000),
  };
}

/** A validade do desafio, se ele for nosso e ainda valer; `null` se não. */
export function openIssuanceChallenge(
  secret: Buffer,
  challenge: Buffer,
  now: Date,
): Date | null {
  if (challenge.length !== ISSUANCE_CHALLENGE_BYTES) return null;
  const body = challenge.subarray(0, 20);
  const tag = hmac(secret, body).subarray(0, 16);
  if (!timingSafeEqual(tag, challenge.subarray(20))) return null;
  const expiresAt = new Date(challenge.readUInt32BE(0) * 1000);
  return expiresAt.getTime() > now.getTime() ? expiresAt : null;
}

/** O que fica guardado de um desafio usado: o hash. */
export const usedChallengeId = (challenge: Buffer) =>
  sha256(challenge).toString('hex');

/** O id da instalação: 32 bytes ao acaso que o app cria uma vez. */
export const INSTALLATION_BYTES = 32;

const ISSUANCE_LABEL = Buffer.from('AO UERJ token issuance v1', 'ascii');

/**
 * O `requestHash` que o app passa à Play Integrity: o SHA-256, em hex
 * minúsculo, do rótulo, do desafio, da instalação e dos pedidos, nessa
 * ordem. Todos têm tamanho fixo, então a concatenação não é ambígua; a
 * atestação passa a valer só para este pedido.
 */
export function issuanceRequestHash({
  challenge,
  installation,
  tokenRequests,
}: {
  challenge: Buffer;
  installation: Buffer;
  tokenRequests: readonly Buffer[];
}): string {
  return sha256(
    Buffer.concat([ISSUANCE_LABEL, challenge, installation, ...tokenRequests]),
  ).toString('hex');
}

/**
 * O contador de lotes de uma instalação num dia (AAAA-MM-DD, UTC): um HMAC
 * que muda a cada dia, então os contadores de dias diferentes não se ligam,
 * e o banco sozinho não leva à instalação.
 */
export const installationDayId = (
  secret: Buffer,
  installation: Buffer,
  day: string,
) =>
  hmac(
    secret,
    Buffer.concat([Buffer.from(day, 'ascii'), installation]),
  ).toString('hex');
