import assert from 'node:assert/strict';
import { createPublicKey, generateKeyPairSync, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { createStudentAccess } from '../src/modules/access/application.ts';
import {
  challengeDigest,
  encodeChallenge,
  issuerKey,
  parseToken,
  tokenFromAuthorization,
  verifyToken,
  type IssuerKey,
} from '../src/modules/access/domain.ts';
import { memorySingleUse } from './support.ts';
import {
  mintToken,
  rsaPssKeyPair,
  signingKeys,
  studentKeys,
} from './tokens.ts';

/*
 * O resgate dos tokens de aluno (Privacy Pass, tipo 0x0002). O vetor 1 da
 * RFC 9578 garante que o servidor verifica exatamente o que qualquer cliente
 * que siga a norma produz.
 */
const VECTOR = JSON.parse(
  readFileSync(
    new URL('./fixtures/rfc9578-type2.json', import.meta.url),
    'utf8',
  ),
) as Record<'pkI' | 'token_challenge' | 'nonce' | 'token', string>;
const hex = (value: string) => Buffer.from(value, 'hex');
const FAR = new Date(Date.UTC(2100, 0, 1));

test('the RFC 9578 vector: the same challenge bytes, key id and a valid signature', () => {
  const challenge = encodeChallenge({
    issuer: 'issuer.example',
    redemptionContext: hex(
      '8e7acc900e393381e8810b7c9e4a68b5163f1f880ab6688a6ffe780923609e88',
    ),
    origins: ['origin.example'],
  });
  assert.equal(challenge.toString('hex'), VECTOR.token_challenge);

  const key = issuerKey(hex(VECTOR.pkI), FAR);
  // a forma da RFC passa intacta pela normalização
  assert.equal(key.spki.toString('hex'), VECTOR.pkI);

  const token = parseToken(hex(VECTOR.token));
  assert.ok(token);
  assert.equal(token.nonce.toString('hex'), VECTOR.nonce);
  assert.ok(token.keyId.equals(key.id));
  const digest = challengeDigest(challenge);
  assert.deepEqual(
    verifyToken(token, { digest, keys: [key], now: new Date() }),
    { key },
  );

  // um bit trocado na assinatura e ela não vale mais
  const forged = hex(VECTOR.token);
  forged[forged.length - 1] = (forged[forged.length - 1] + 1) % 256;
  assert.deepEqual(
    verifyToken(parseToken(forged)!, { digest, keys: [key], now: new Date() }),
    { rejected: 'bad_signature' },
  );
});

test('a key from Node is published in the RFC form, and only RSA 2048 (as RSA-PSS, with SHA-384) is accepted', () => {
  const [student] = studentKeys(1);
  // o OpenSSL põe NULL nos parâmetros do SHA-384; publicada, a chave não tem
  const exported = student.publicKey.export({ type: 'spki', format: 'der' });
  assert.notEqual(exported.length, student.issuer.spki.length);
  assert.equal(student.issuer.spki.length, 342);
  assert.ok(issuerKey(student.issuer.spki, FAR).id.equals(student.issuer.id));

  // a pública RSA comum de uma chave que assina vira a mesma da RFC
  const [signer] = signingKeys(1);
  const plainPublic = createPublicKey(signer.privateKey).export({
    type: 'spki',
    format: 'der',
  });
  assert.ok(issuerKey(plainPublic, FAR).spki.equals(signer.spki));

  const small = generateKeyPairSync('rsa', { modulusLength: 1024 });
  const weak = rsaPssKeyPair('sha256', 32);
  for (const pair of [small, weak])
    assert.throws(
      () =>
        issuerKey(pair.publicKey.export({ type: 'spki', format: 'der' }), FAR),
      /RSA with 2048 bits and exponent 65537/,
    );
});

test('the Authorization header: quoted or not, padded or not, other parameters ignored', () => {
  const token = randomBytes(354);
  const padded = token.toString('base64url') + '=';
  for (const header of [
    `PrivateToken token="${token.toString('base64url')}"`,
    `PrivateToken token=${token.toString('base64url')}`,
    `privatetoken realm="x", token="${padded}"`,
  ])
    assert.ok(tokenFromAuthorization(header)?.equals(token), header);

  for (const header of [
    'Bearer abc',
    'PrivateToken',
    'PrivateToken token="não é base64"',
    'PrivateToken other="abc"',
  ])
    assert.equal(tokenFromAuthorization(header), null, header);
});

const ISSUER = 'pitrol.dev';

function access(keys: IssuerKey[], now = () => Date.UTC(2026, 10, 1)) {
  const spent = new Map<string, Date>();
  return {
    spent,
    access: createStudentAccess({
      keys,
      spentTokens: memorySingleUse(spent),
      issuer: ISSUER,
      origin: ISSUER,
      now,
    }),
  };
}

test('a token is redeemed once; the second use is a double spend', async () => {
  const [student] = studentKeys(1);
  const { access: service, spent } = access([student.issuer]);
  const header = mintToken(student);

  assert.deepEqual(await service.redeem(header), { authenticated: true });
  assert.deepEqual(await service.redeem(header), {
    authenticated: false,
    reason: 'spent',
  });
  // fica só um hash de 64 caracteres, até um dia depois de a chave vencer
  const [[id, until]] = [...spent];
  assert.match(id, /^[0-9a-f]{64}$/);
  assert.equal(
    until.getTime() - student.issuer.notAfter.getTime(),
    24 * 60 * 60 * 1000,
  );
  // e outro token da mesma chave vale
  assert.deepEqual(await service.redeem(mintToken(student)), {
    authenticated: true,
  });
});

test('missing, malformed, foreign, unknown, expired and forged tokens are refused, each for its reason', async () => {
  const [student, stranger] = studentKeys(2);
  const { access: service } = access([student.issuer]);
  const reason = async (header: string | undefined) => {
    const result = await service.redeem(header);
    return result.authenticated ? 'ok' : result.reason;
  };

  assert.equal(await reason(undefined), 'missing');
  assert.equal(await reason('Bearer abc'), 'missing');
  assert.equal(await reason('PrivateToken token="abc"'), 'malformed');
  // um token para outro emissor (outro desafio)
  assert.equal(
    await reason(mintToken(student, { issuer: 'outro.exemplo' })),
    'wrong_challenge',
  );
  // assinado por uma chave que o servidor não conhece
  assert.equal(await reason(mintToken(stranger)), 'unknown_key');
  // com o id da chave certa e a assinatura de outra
  assert.equal(
    await reason(mintToken(student, { signer: stranger.privateKey })),
    'bad_signature',
  );

  // a chave que venceu, com outra ainda valendo
  const [old, current] = [
    studentKeys(1, new Date(Date.UTC(2026, 9, 1)))[0],
    studentKeys(1)[0],
  ];
  const rotated = access([old.issuer, current.issuer]);
  assert.deepEqual(await rotated.access.redeem(mintToken(old)), {
    authenticated: false,
    reason: 'expired_key',
  });
  assert.equal(rotated.spent.size, 0);

  // e, sem nenhuma chave valendo, o acesso está fora do ar
  const expired = access([student.issuer], () =>
    student.issuer.notAfter.getTime(),
  );
  const late = await expired.access.redeem(mintToken(student));
  assert.deepEqual(late, { authenticated: false, reason: 'unavailable' });
});

test('the challenge names the issuer and the newest key; with no valid key there is none', async () => {
  const older = studentKeys(1, new Date(Date.UTC(2026, 11, 1)))[0];
  const newer = studentKeys(1, new Date(Date.UTC(2027, 0, 1)))[0];
  const { access: service } = access([older.issuer, newer.issuer]);
  const challenge = service.challenge();
  assert.ok(challenge);
  assert.ok(challenge.tokenKey.equals(newer.issuer.spki));
  assert.ok(
    challenge.challenge.equals(
      encodeChallenge({
        issuer: ISSUER,
        redemptionContext: Buffer.alloc(0),
        origins: [ISSUER],
      }),
    ),
  );

  // a chave mais antiga ainda vale no resgate
  const { access: both } = access([older.issuer, newer.issuer]);
  assert.deepEqual(await both.redeem(mintToken(older)), {
    authenticated: true,
  });
  assert.equal(access([]).access.challenge(), null);
});
