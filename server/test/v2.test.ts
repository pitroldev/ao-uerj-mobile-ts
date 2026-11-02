import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';
import { after, test } from 'node:test';

import express from 'express';
import { pino, type Logger } from 'pino';

import { handleError } from '../src/adapters/inbound/http/errors.ts';
import { requestLog } from '../src/adapters/inbound/http/middleware.ts';
import { requireStudent } from '../src/adapters/inbound/http/v2/studentAuth.ts';
import { createServer, type Server } from '../src/composition.ts';
import { encodeChallenge } from '../src/modules/access/domain.ts';
import type { SingleUse } from '../src/modules/access/ports.ts';
import { createPortalWatch } from '../src/modules/portal/application.ts';
import { UnavailableError } from '../src/shared/errors.ts';
import {
  memoryAttachments,
  memoryRepositories,
  silentLogger,
  switchableDatabase,
  testConfig,
} from './support.ts';
import { base64urlPadded, mintToken, studentKeys } from './tokens.ts';

/*
 * A API v2 (`/aouerj/v2`): o token anônimo de aluno (Privacy Pass) e a rota
 * que diz se a requisição veio autenticada. As rotas de `/aouerj` seguem
 * iguais, sem token.
 */

const [student, stranger] = studentKeys(2);
const KEYS = `${student.issuer.spki.toString('base64')}@2100-01-01`;
const opened: Server[] = [];

after(async () => {
  await Promise.all(opened.map(server => server.stop()));
});

async function serve({
  env = { PRIVATE_TOKEN_KEYS: KEYS },
  logger = silentLogger,
  spentTokens,
}: {
  env?: Record<string, string>;
  logger?: Logger;
  spentTokens?: SingleUse;
} = {}) {
  const memory = memoryRepositories();
  const db = switchableDatabase();
  const server = createServer(testConfig(env), logger, {
    database: db.database,
    repositories: spentTokens
      ? { ...memory.repositories, spentTokens }
      : memory.repositories,
    attachments: memoryAttachments().store,
    portal: createPortalWatch({ probe: async () => 200 }),
  });
  opened.push(server);
  const { port } = await server.start(0);
  const base = `http://127.0.0.1:${port}`;
  const get = (path: string, authorization?: string) =>
    fetch(`${base}${path}`, {
      headers: authorization ? { authorization } : {},
    });
  return { base, get, memory, db };
}

/** Os parâmetros do `WWW-Authenticate: PrivateToken …`. */
function challengeOf(header: string | null) {
  const text = header ?? '';
  assert.ok(text.startsWith('PrivateToken '), text || 'sem cabeçalho');
  const value = (name: string) =>
    new RegExp(`${name}="([A-Za-z0-9_=-]+)"`).exec(text)?.[1] ?? '';
  return { challenge: value('challenge'), tokenKey: value('token-key') };
}

const UNAUTHENTICATED = {
  error: 'unauthenticated',
  message: 'A valid private token is required',
};

test('without a token, a 401 carries the challenge and the key the app needs, and nothing more', async () => {
  const app = await serve();
  const response = await app.get('/aouerj/v2/auth');
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), UNAUTHENTICATED);

  const { challenge, tokenKey } = challengeOf(
    response.headers.get('www-authenticate'),
  );
  // emissor e origem pitrol.dev, sem redemption_context: tokens buscados antes
  assert.equal(
    challenge,
    base64urlPadded(
      encodeChallenge({
        issuer: 'pitrol.dev',
        redemptionContext: Buffer.alloc(0),
        origins: ['pitrol.dev'],
      }),
    ),
  );
  // a chave na forma da RFC, com o `=` do fim que a RFC 9577 pede
  assert.equal(tokenKey, base64urlPadded(student.issuer.spki));
  assert.equal(tokenKey.length % 4, 0);
});

test('a valid token authenticates once; the same token again is a 401', async () => {
  const app = await serve();
  const header = mintToken(student);

  const first = await app.get('/aouerj/v2/auth', header);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await first.json(), { authenticated: true });

  const again = await app.get('/aouerj/v2/auth', header);
  assert.equal(again.status, 401);
  assert.deepEqual(await again.json(), UNAUTHENTICATED);
  // o que ficou do token: um hash
  assert.equal(app.memory.data.spent.size, 1);
  assert.match([...app.memory.data.spent.keys()][0], /^[0-9a-f]{64}$/);
});

test('a forged, foreign or malformed token gets the very same 401', async () => {
  const app = await serve();
  for (const header of [
    mintToken(stranger),
    mintToken(student, { signer: stranger.privateKey }),
    mintToken(student, { issuer: 'outro.exemplo' }),
    'PrivateToken token="abc"',
    'Bearer token-de-administracao',
  ]) {
    const response = await app.get('/aouerj/v2/auth', header);
    assert.equal(response.status, 401, header.slice(0, 30));
    assert.deepEqual(await response.json(), UNAUTHENTICATED);
    assert.ok(response.headers.get('www-authenticate'));
  }
  assert.equal(app.memory.data.spent.size, 0);
});

test('without keys the v2 is unavailable, and the current routes still answer without any token', async () => {
  const app = await serve({ env: {} });
  const v2 = await app.get('/aouerj/v2/auth', mintToken(student));
  assert.equal(v2.status, 503);
  assert.deepEqual(await v2.json(), {
    error: 'student_access_unavailable',
    message: 'Student access is not available right now',
  });

  const mural = await fetch(`${app.base}/aouerj/messages/get`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      disciplina: 'IME01-10001',
      periodo: '2026.2',
      turma: '1',
    }),
  });
  assert.equal(mural.status, 200);
  assert.equal((await app.get('/aouerj/health')).status, 200);
  assert.equal((await app.get('/aouerj/v2/nada')).status, 404);
});

test('without the database a student route is a 503 at once, and the token stays good', async () => {
  const app = await serve();
  const header = mintToken(student);
  app.db.state.ready = false;
  const offline = await app.get('/aouerj/v2/auth', header);
  assert.equal(offline.status, 503);
  assert.deepEqual(await offline.json(), {
    error: 'database_unavailable',
    message: 'The database is temporarily unavailable',
  });
  assert.equal(app.memory.data.spent.size, 0);

  // o banco volta e o mesmo token vale
  app.db.state.ready = true;
  assert.equal((await app.get('/aouerj/v2/auth', header)).status, 200);
});

test('a database that fails while spending the token is a 503', async () => {
  const app = await serve({
    spentTokens: {
      spend: async () => {
        throw new UnavailableError(
          'database_unavailable',
          'The database is temporarily unavailable',
        );
      },
    },
  });
  const response = await app.get('/aouerj/v2/auth', mintToken(student));
  assert.equal(response.status, 503);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, 'database_unavailable');
});

test('a failure while refusing goes to the error handler, not to an unhandled rejection', async () => {
  const app = express();
  app.use(requestLog(silentLogger));
  app.get(
    '/rota',
    requireStudent({
      redeem: async () => ({ authenticated: false, reason: 'spent' }),
      challenge: () => {
        throw new Error('quebrou ao montar o desafio');
      },
    }),
    (req, res) => {
      res.json({ authenticated: true });
    },
  );
  app.use(handleError);
  const server = app.listen(0);
  await once(server, 'listening');
  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/rota`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: 'internal_server_error',
      message: 'Unexpected server error',
    });
  } finally {
    server.close();
  }
});

test('the token never reaches the log; only the reason of a refusal does', async () => {
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
  const header = mintToken(student);
  await app.get('/aouerj/v2/auth', header);
  await app.get('/aouerj/v2/auth', header);

  const token = header.slice('PrivateToken token="'.length, -1);
  const log = lines.join('');
  assert.doesNotMatch(log, /PrivateToken|authorization/i);
  assert.equal(log.includes(token.slice(0, 40)), false);
  const refused = lines
    .map(line => JSON.parse(line) as { msg?: string; reason?: string })
    .find(line => line.msg === 'student token refused');
  assert.equal(refused?.reason, 'spent');
});
