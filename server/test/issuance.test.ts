import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  createStudentAccess,
  createTokenIssuer,
  ISSUANCE_CHALLENGE_TTL_MS,
} from '../src/modules/access/application.ts';
import {
  blindSign,
  issuanceRequestHash,
  parseTokenRequest,
  signingKey,
  type IssuerKey,
} from '../src/modules/access/domain.ts';
import type {
  AppAttester,
  Attestation,
  IssuanceRequest,
} from '../src/modules/access/ports.ts';
import { InvalidInputError } from '../src/shared/errors.ts';
import { manualClock, memoryCounter, memorySingleUse } from './support.ts';
import {
  authorization,
  blindToken,
  signingKeys,
  studentKeys,
} from './tokens.ts';

/*
 * A emissão dos tokens de aluno: o desafio de uso único, a atestação do app,
 * o limite por instalação e a assinatura cega. O vetor 1 da RFC 9578 confere
 * a assinatura do servidor e o cliente de teste, que faz o papel do app.
 */

const VECTOR = JSON.parse(
  readFileSync(
    new URL('./fixtures/rfc9578-type2.json', import.meta.url),
    'utf8',
  ),
) as Record<
  | 'skI'
  | 'pkI'
  | 'token_challenge'
  | 'nonce'
  | 'blind'
  | 'salt'
  | 'token_request'
  | 'token_response'
  | 'token',
  string
>;
const hex = (value: string) => Buffer.from(value, 'hex');
const FAR = new Date(Date.UTC(2100, 0, 1));

test('the RFC 9578 vector: the issuer signs the blinded request, and the client rebuilds the request and the token', () => {
  const pem = hex(VECTOR.skI).toString('ascii');
  const der = Buffer.from(
    pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, ''),
    'base64',
  );
  const key = signingKey(der, FAR);
  // a pública sai da privada (RSA comum) na forma RSA-PSS da RFC
  assert.equal(key.spki.toString('hex'), VECTOR.pkI);

  const request = parseTokenRequest(hex(VECTOR.token_request));
  assert.ok(request);
  assert.equal(blindSign(key, request).toString('hex'), VECTOR.token_response);

  // o lado do app, com o nonce, o sal e o fator cego do vetor
  const blinded = blindToken(key.spki, {
    challenge: hex(VECTOR.token_challenge),
    nonce: hex(VECTOR.nonce),
    salt: hex(VECTOR.salt),
    blind: BigInt(`0x${VECTOR.blind}`),
  });
  assert.equal(blinded.tokenRequest.toString('hex'), VECTOR.token_request);
  assert.equal(
    blinded.finalize(hex(VECTOR.token_response)).toString('hex'),
    VECTOR.token,
  );
});

/** Uma atestação de mentira: confia quando o token é `ok:<requestHash>`. */
function fakeAttester() {
  const seen: string[] = [];
  const attester: AppAttester = {
    async verify(integrityToken, requestHash): Promise<Attestation> {
      seen.push(requestHash);
      return integrityToken === `ok:${requestHash}`
        ? { trusted: true }
        : { trusted: false, reason: 'device_integrity' };
    },
  };
  return { attester, seen };
}

function setup({
  keys = signingKeys(1),
  attester = fakeAttester().attester,
  batchSize = 32,
  batchesPerDay = 4,
  clock = manualClock(Date.UTC(2026, 10, 1, 12)),
}: {
  keys?: IssuerKey[];
  attester?: AppAttester | null;
  batchSize?: number;
  batchesPerDay?: number;
  clock?: ReturnType<typeof manualClock>;
} = {}) {
  const used = new Map<string, Date>();
  const counters = new Map<string, { count: number; until: Date }>();
  const spent = new Map<string, Date>();
  const issuer = createTokenIssuer({
    keys,
    attester,
    usedChallenges: memorySingleUse(used),
    counter: memoryCounter(counters),
    batchSize,
    batchesPerDay,
    now: clock.now,
  });
  const access = createStudentAccess({
    keys,
    spentTokens: memorySingleUse(spent),
    issuer: 'pitrol.dev',
    origin: 'pitrol.dev',
    now: clock.now,
  });
  return { issuer, access, used, counters, spent, clock, keys };
}

/** O app: pede o desafio, cega `count` tokens e monta o pedido atestado. */
function prepare(
  issuer: ReturnType<typeof setup>['issuer'],
  {
    count = 3,
    installation = randomBytes(32),
    attest = (requestHash: string) => `ok:${requestHash}`,
  } = {},
) {
  const offered = issuer.challenge();
  assert.ok(offered, 'sem desafio');
  const blinded = Array.from({ length: count }, () =>
    blindToken(offered.tokenKey),
  );
  const tokenRequests = blinded.map(token => token.tokenRequest);
  const request: IssuanceRequest = {
    challenge: offered.challenge,
    installation,
    tokenRequests,
    integrityToken: attest(
      issuanceRequestHash({
        challenge: offered.challenge,
        installation,
        tokenRequests,
      }),
    ),
  };
  return { offered, blinded, request };
}

test('a batch is blindly signed, and each token redeems once', async () => {
  const { issuer, access, used, counters } = setup();
  const { offered, blinded, request } = prepare(issuer);
  assert.equal(offered.challenge.length, 36);
  assert.equal(
    offered.expiresAt.getTime(),
    Date.UTC(2026, 10, 1, 12) + ISSUANCE_CHALLENGE_TTL_MS,
  );

  const result = await issuer.issue(request);
  assert.ok(result.issued, JSON.stringify(result));
  assert.ok(result.tokenKey.equals(offered.tokenKey));
  assert.equal(result.tokenResponses.length, 3);

  const tokens = blinded.map((token, index) =>
    token.finalize(result.tokenResponses[index]),
  );
  for (const token of tokens)
    assert.deepEqual(await access.redeem(authorization(token)), {
      authenticated: true,
    });
  assert.deepEqual(await access.redeem(authorization(tokens[0])), {
    authenticated: false,
    reason: 'spent',
  });

  // o que ficou da emissão: o hash do desafio e um contador sem a instalação
  assert.equal(used.size, 1);
  const [[counterId, counter]] = [...counters];
  assert.match(counterId, /^[0-9a-f]{64}$/);
  assert.equal(counterId.includes(request.installation.toString('hex')), false);
  assert.equal(counter.count, 1);
});

test('the attestation covers exactly this challenge, installation and batch', async () => {
  const { attester, seen } = fakeAttester();
  const { issuer } = setup({ attester });
  const { request } = prepare(issuer);

  // um pedido trocado depois da atestação muda o requestHash
  const [, ...rest] = request.tokenRequests;
  const swapped = { ...request, tokenRequests: [rest[0], ...rest] };
  const refused = await issuer.issue(swapped);
  assert.deepEqual(refused, {
    issued: false,
    reason: 'attestation_failed',
    detail: 'device_integrity',
  });
  assert.equal(seen.length, 1);
  assert.equal(
    seen[0],
    issuanceRequestHash({
      challenge: swapped.challenge,
      installation: swapped.installation,
      tokenRequests: swapped.tokenRequests,
    }),
  );
  // e o desafio já foi gasto: o pedido certo precisa de outro
  assert.deepEqual(await issuer.issue(request), {
    issued: false,
    reason: 'invalid_challenge',
  });
  assert.equal(seen.length, 1);
});

test('a forged, expired or reused challenge gets no tokens', async () => {
  const { issuer, clock } = setup();

  const forged = prepare(issuer).request;
  forged.challenge = Buffer.from(forged.challenge);
  forged.challenge[10] = (forged.challenge[10] + 1) % 256;
  assert.deepEqual(await issuer.issue(forged), {
    issued: false,
    reason: 'invalid_challenge',
  });

  const late = prepare(issuer).request;
  clock.advance(ISSUANCE_CHALLENGE_TTL_MS);
  assert.deepEqual(await issuer.issue(late), {
    issued: false,
    reason: 'invalid_challenge',
  });

  const once = prepare(issuer).request;
  assert.equal((await issuer.issue(once)).issued, true);
  assert.deepEqual(await issuer.issue(once), {
    issued: false,
    reason: 'invalid_challenge',
  });
});

test('a request blinded for another key, or too big for the modulus, is refused before the challenge is spent', async () => {
  const { issuer, used } = setup();
  const { request } = prepare(issuer, { count: 2 });
  // uma chave com o mesmo último byte do id (1 em 256) passaria nessa parte
  // da conferência: o teste usa outra
  const ours = request.tokenRequests[0][2];
  let [other] = signingKeys(1);
  while (other.id[other.id.length - 1] === ours) [other] = signingKeys(1);

  const foreign = blindToken(other.spki).tokenRequest;
  const tooBig = Buffer.concat([
    request.tokenRequests[0].subarray(0, 3),
    Buffer.alloc(256, 0xff),
  ]);
  for (const bad of [foreign, tooBig])
    assert.deepEqual(
      await issuer.issue({
        ...request,
        tokenRequests: [request.tokenRequests[0], bad],
      }),
      { issued: false, reason: 'invalid_token_request' },
    );
  assert.equal(used.size, 0);
  assert.equal((await issuer.issue(request)).issued, true);
});

test('an installation gets its batches per day, and the next day starts over', async () => {
  const { issuer, counters, clock } = setup({ batchesPerDay: 2 });
  const installation = randomBytes(32);

  for (let batch = 0; batch < 2; batch += 1)
    assert.equal(
      (await issuer.issue(prepare(issuer, { installation }).request)).issued,
      true,
    );
  assert.deepEqual(
    await issuer.issue(prepare(issuer, { installation }).request),
    {
      issued: false,
      reason: 'limit_reached',
      retryAt: new Date(Date.UTC(2026, 10, 2)),
    },
  );
  // outra instalação não é afetada
  assert.equal((await issuer.issue(prepare(issuer).request)).issued, true);

  clock.advance(12 * 60 * 60 * 1000);
  assert.equal(
    (await issuer.issue(prepare(issuer, { installation }).request)).issued,
    true,
  );
  // o contador de cada dia é outro, e nenhum se liga ao seguinte
  assert.equal(counters.size, 3);
  for (const { until } of counters.values())
    assert.ok(until.getTime() >= Date.UTC(2026, 10, 3));
});

test('without a private key or an attester there is no issuance, and the batch size is enforced', async () => {
  const publicOnly = setup({ keys: [studentKeys(1)[0].issuer] });
  assert.equal(publicOnly.issuer.challenge(), null);

  const keys = signingKeys(1);
  const working = setup({ keys });
  const { request } = prepare(working.issuer);
  const unattested = setup({ keys, attester: null });
  assert.equal(unattested.issuer.challenge(), null);
  assert.deepEqual(await unattested.issuer.issue(request), {
    issued: false,
    reason: 'unavailable',
  });

  const small = setup({ keys, batchSize: 2 });
  await assert.rejects(
    small.issuer.issue(prepare(small.issuer, { count: 3 }).request),
    InvalidInputError,
  );
  await assert.rejects(
    small.issuer.issue({
      ...prepare(small.issuer, { count: 1 }).request,
      installation: randomBytes(16),
    }),
    InvalidInputError,
  );
});

test('the issuer signs with the newest private key; tokens of the older one still redeem', async () => {
  const [older] = signingKeys(1, new Date(Date.UTC(2026, 11, 1)));
  const [newer] = signingKeys(1, new Date(Date.UTC(2027, 0, 1)));
  const { issuer, access } = setup({ keys: [older, newer] });
  const offered = issuer.challenge();
  assert.ok(offered?.tokenKey.equals(newer.spki));

  // um token da chave antiga, emitido antes da troca, continua valendo
  const before = setup({ keys: [older] });
  const { blinded, request } = prepare(before.issuer, { count: 1 });
  const result = await before.issuer.issue(request);
  assert.ok(result.issued);
  const token = blinded[0].finalize(result.tokenResponses[0]);
  assert.deepEqual(await access.redeem(authorization(token)), {
    authenticated: true,
  });
});
