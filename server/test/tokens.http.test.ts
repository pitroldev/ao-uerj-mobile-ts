import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Writable } from 'node:stream';
import { after, test } from 'node:test';

import { pino, type Logger } from 'pino';

import type {
  TokenChallengeResponse,
  TokenIssuanceRequest,
  TokenIssuanceResponse,
} from '../src/adapters/inbound/http/contract.ts';
import { createServer, type Server } from '../src/composition.ts';
import { issuanceRequestHash } from '../src/modules/access/domain.ts';
import type { AppAttester } from '../src/modules/access/ports.ts';
import { createPortalWatch } from '../src/modules/portal/application.ts';
import { UnavailableError } from '../src/shared/errors.ts';
import {
  memoryAttachments,
  memoryRepositories,
  silentLogger,
  switchableDatabase,
  testConfig,
} from './support.ts';
import {
  authorization,
  base64urlPadded,
  blindToken,
  privateKeyEntry,
  signingKeys,
  studentKeys,
} from './tokens.ts';

/*
 * A emissão pela API v2: `GET /aouerj/v2/tokens/challenge` e
 * `POST /aouerj/v2/tokens`, do jeito que o app vai usar, até o token valer
 * em `/aouerj/v2/auth`.
 */

const [key] = signingKeys(1);
const KEYS = privateKeyEntry(key);
const opened: Server[] = [];

after(async () => {
  await Promise.all(opened.map(server => server.stop()));
});

/** Confia quando o token de integridade é `ok:<requestHash>`. */
const attester: AppAttester = {
  async verify(integrityToken, requestHash) {
    return integrityToken === `ok:${requestHash}`
      ? { trusted: true }
      : { trusted: false, reason: 'device_integrity' };
  },
};

async function serve({
  env = {},
  logger = silentLogger,
  attest = attester,
}: {
  env?: Record<string, string>;
  logger?: Logger;
  attest?: AppAttester | null;
} = {}) {
  const memory = memoryRepositories();
  const db = switchableDatabase();
  const server = createServer(
    testConfig({ PRIVATE_TOKEN_KEYS: KEYS, ...env }),
    logger,
    {
      database: db.database,
      repositories: memory.repositories,
      attachments: memoryAttachments().store,
      portal: createPortalWatch({ probe: async () => 200 }),
      attester: attest,
    },
  );
  opened.push(server);
  const { port } = await server.start(0);
  const base = `http://127.0.0.1:${port}`;
  const challenge = () => fetch(`${base}/aouerj/v2/tokens/challenge`);
  const issue = (body: unknown) =>
    fetch(`${base}/aouerj/v2/tokens`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const auth = (header: string) =>
    fetch(`${base}/aouerj/v2/auth`, { headers: { authorization: header } });
  return { challenge, issue, auth, memory, db };
}

const fromBase64url = (value: string) => Buffer.from(value, 'base64url');

/** O app: pede o desafio, cega os tokens e atesta o pedido. */
async function prepare(
  app: Awaited<ReturnType<typeof serve>>,
  { count = 3, installation = randomBytes(32), attest = true } = {},
) {
  const response = await app.challenge();
  assert.equal(response.status, 200);
  const offered = (await response.json()) as TokenChallengeResponse;
  const challenge = fromBase64url(offered.challenge);
  const blinded = Array.from({ length: count }, () =>
    blindToken(fromBase64url(offered.tokenKey)),
  );
  const tokenRequests = blinded.map(token => token.tokenRequest);
  const requestHash = issuanceRequestHash({
    challenge,
    installation,
    tokenRequests,
  });
  const body: TokenIssuanceRequest = {
    challenge: offered.challenge,
    installation: base64urlPadded(installation),
    integrityToken: attest ? `ok:${requestHash}` : 'falso',
    tokenRequests: tokenRequests.map(base64urlPadded),
  };
  return { offered, blinded, body };
}

test('the app gets a challenge, a batch of blind signatures, and tokens that open /aouerj/v2/auth once each', async () => {
  const app = await serve();
  const response = await app.challenge();
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const offered = (await response.json()) as TokenChallengeResponse;
  assert.equal(fromBase64url(offered.challenge).length, 36);
  assert.equal(offered.tokenKey, base64urlPadded(key.spki));
  assert.ok(Date.parse(offered.expiresAt) > Date.now());
  // o desafio não fica guardado
  assert.equal(app.memory.data.usedChallenges.size, 0);

  const { blinded, body } = await prepare(app);
  const issued = await app.issue(body);
  assert.equal(issued.status, 200);
  assert.equal(issued.headers.get('cache-control'), 'no-store');
  const batch = (await issued.json()) as TokenIssuanceResponse;
  assert.equal(batch.tokenKey, base64urlPadded(key.spki));
  assert.equal(batch.tokenResponses.length, 3);

  const tokens = blinded.map((token, index) =>
    token.finalize(fromBase64url(batch.tokenResponses[index])),
  );
  for (const token of tokens)
    assert.equal((await app.auth(authorization(token))).status, 200);
  assert.equal((await app.auth(authorization(tokens[1]))).status, 401);
});

test('each refusal has its own code: challenge, attestation, key, limit and shape', async () => {
  const app = await serve({ env: { TOKEN_BATCHES_PER_DAY: '1' } });
  const errorOf = async (response: Response) => [
    response.status,
    ((await response.json()) as { error: string }).error,
  ];

  // o desafio vale uma vez
  const { body } = await prepare(app);
  assert.equal((await app.issue(body)).status, 200);
  assert.deepEqual(await errorOf(await app.issue(body)), [
    403,
    'invalid_challenge',
  ]);

  const unattested = await prepare(app, { attest: false });
  assert.deepEqual(await errorOf(await app.issue(unattested.body)), [
    403,
    'attestation_failed',
  ]);

  const foreign = await prepare(app);
  foreign.body.tokenRequests[0] = base64urlPadded(
    blindToken(signingKeys(1)[0].spki).tokenRequest,
  );
  assert.deepEqual(await errorOf(await app.issue(foreign.body)), [
    422,
    'invalid_token_request',
  ]);

  // a mesma instalação, no limite do dia (um lote, neste teste)
  const installation = randomBytes(32);
  assert.equal(
    (await app.issue((await prepare(app, { installation })).body)).status,
    200,
  );
  const limited = await app.issue((await prepare(app, { installation })).body);
  assert.deepEqual(await errorOf(limited), [429, 'issuance_limit_reached']);
  const retryAt = Date.parse(limited.headers.get('retry-after') ?? '');
  assert.ok(retryAt > Date.now() && retryAt <= Date.now() + 86_400_000);

  // a forma do pedido
  const shapes: [unknown, RegExp][] = [
    [{}, /challenge is required/],
    [{ ...body, installation: 'AAAA' }, /installation must have 32 bytes/],
    [{ ...body, tokenRequests: [] }, /at least 1 request/],
    [
      {
        ...body,
        tokenRequests: Array.from({ length: 33 }, () => body.tokenRequests[0]),
      },
      /at most 32 requests/,
    ],
    [{ ...body, tokenRequests: ['não é base64'] }, /must be base64url/],
    [{ ...body, integrityToken: '' }, /integrityToken is required/],
  ];
  for (const [shape, message] of shapes) {
    const response = await app.issue(shape);
    assert.equal(response.status, 400, String(message));
    const answer = (await response.json()) as { message: string };
    assert.match(answer.message, message);
  }
});

test('without a private key or an attester there is no issuance, but redemption keeps working', async () => {
  const [publicOnly] = studentKeys(1);
  const keysOnly = await serve({
    env: {
      PRIVATE_TOKEN_KEYS: `${publicOnly.issuer.spki.toString('base64')}@2100-01-01`,
    },
  });
  const unattested = await serve({ attest: null });
  for (const app of [keysOnly, unattested]) {
    const response = await app.challenge();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: 'token_issuance_unavailable',
      message: 'Token issuance is not available right now',
    });
  }
  const refused = await unattested.issue((await prepareWithoutServer()).body);
  assert.equal(refused.status, 503);
  assert.equal((await unattested.auth('PrivateToken token="abc"')).status, 401);
});

/** Um pedido bem formado de um desafio qualquer (sem pedir ao servidor). */
async function prepareWithoutServer() {
  const blinded = blindToken(key.spki);
  return {
    body: {
      challenge: base64urlPadded(randomBytes(36)),
      installation: base64urlPadded(randomBytes(32)),
      integrityToken: 'ok',
      tokenRequests: [base64urlPadded(blinded.tokenRequest)],
    } satisfies TokenIssuanceRequest,
  };
}

test('Play Integrity out of reach and the database down are a 503, and the challenge route needs no database', async () => {
  const google: AppAttester = {
    verify: async () => {
      throw new UnavailableError(
        'attestation_unavailable',
        'App attestation is temporarily unavailable',
      );
    },
  };
  const app = await serve({ attest: google });
  const response = await app.issue((await prepare(app)).body);
  assert.equal(response.status, 503);
  assert.equal(
    ((await response.json()) as { error: string }).error,
    'attestation_unavailable',
  );

  app.db.state.ready = false;
  assert.equal((await app.challenge()).status, 200);
  const offline = await app.issue((await prepare(app)).body);
  assert.equal(offline.status, 503);
  assert.equal(
    ((await offline.json()) as { error: string }).error,
    'database_unavailable',
  );
});

test('challenges and batches share a limit per IP', async () => {
  const app = await serve({ env: { TOKEN_RATE_LIMIT_PER_MINUTE: '2' } });
  assert.equal((await app.challenge()).status, 200);
  assert.equal((await app.issue({})).status, 400);
  const limited = await app.challenge();
  assert.equal(limited.status, 429);
});

test('the log says how many tokens and why a batch was refused, never the installation or the attestation', async () => {
  const lines: string[] = [];
  const logger = pino(
    { level: 'info' },
    new Writable({
      write(chunk, _encoding, done) {
        lines.push(String(chunk));
        done();
      },
    }),
  );
  const app = await serve({ logger });
  const good = await prepare(app);
  await app.issue(good.body);
  const bad = await prepare(app, { attest: false });
  await app.issue(bad.body);

  const log = lines.join('');
  for (const secret of [
    good.body.installation,
    good.body.integrityToken,
    good.body.tokenRequests[0].slice(0, 40),
    good.body.challenge,
  ])
    assert.equal(log.includes(secret), false, secret.slice(0, 20));
  const entries = lines.map(
    line =>
      JSON.parse(line) as {
        msg?: string;
        tokens?: number;
        reason?: string;
        detail?: string;
      },
  );
  assert.equal(entries.find(line => line.msg === 'tokens issued')?.tokens, 3);
  const refused = entries.find(line => line.msg === 'token issuance refused');
  assert.equal(refused?.reason, 'attestation_failed');
  assert.equal(refused?.detail, 'device_integrity');
});
