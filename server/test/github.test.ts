import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { test } from 'node:test';

import { createGitHubIssueTracker } from '../src/adapters/outbound/github/issueTracker.ts';
import { DomainError } from '../src/shared/errors.ts';
import { manualClock } from './support.ts';

/*
 * O cliente do GitHub App: o JWT do app (RS256), o token da instalação (em
 * cache até perto de vencer), os issues e o comentário da contagem, que só
 * é editado se foi o próprio app que escreveu.
 */

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const REPO = 'pitroldev/ao-uerj-mobile-ts';

type Call = { method: string; url: string; auth: string; body: unknown };

function fakeApi(routes: Record<string, (call: Call) => [number, unknown]>) {
  const calls: Call[] = [];
  const fetch = (async (input: string | URL, init: RequestInit = {}) => {
    const url = String(input).replace('https://api.github.com', '');
    const headers = init.headers as Record<string, string>;
    const call: Call = {
      method: init.method ?? 'GET',
      url,
      auth: headers.Authorization,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const route = routes[`${call.method} ${url.split('?')[0]}`];
    const [status, json] = route
      ? route(call)
      : [404, { message: 'Not Found' }];
    return new Response(json === null ? null : JSON.stringify(json), {
      status,
    });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const issue = (number: number, extra: Record<string, unknown> = {}) => ({
  number,
  title: `[Sugestão] Ideia ${number}`,
  html_url: `https://github.com/${REPO}/issues/${number}`,
  state: 'open',
  state_reason: null,
  labels: [{ name: 'enhancement' }, { name: 'sugestão do app' }],
  reactions: { '+1': 4 },
  updated_at: '2026-11-19T13:00:00Z',
  ...extra,
});

test('the app signs a JWT, asks the installation once and keeps the token until near the end', async () => {
  const clock = manualClock(Date.UTC(2026, 10, 19, 13));
  const api = fakeApi({
    [`GET /repos/${REPO}/installation`]: () => [200, { id: 777 }],
    'POST /app/installations/777/access_tokens': () => [
      201,
      {
        token: 'ghs_instalacao',
        expires_at: new Date(clock.now() + 60 * 60 * 1000).toISOString(),
      },
    ],
    [`GET /repos/${REPO}/issues/31`]: () => [200, issue(31)],
    [`GET /repos/${REPO}/issues/32`]: () => [404, { message: 'Not Found' }],
  });
  const tracker = createGitHubIssueTracker(
    { appId: '123456', privateKey, repository: REPO, installationId: null },
    { fetch: api.fetch, now: clock.now },
  );

  const found = await tracker.getIssue(31);
  assert.deepEqual(found, {
    number: 31,
    title: '[Sugestão] Ideia 31',
    url: `https://github.com/${REPO}/issues/31`,
    state: 'open',
    stateReason: null,
    labels: ['enhancement', 'sugestão do app'],
    plusOnes: 4,
    pullRequest: false,
    updatedAt: new Date('2026-11-19T13:00:00Z'),
  });
  assert.equal(await tracker.getIssue(32), null);

  // o JWT: RS256, emitido pelo app, um minuto para trás e menos de dez à frente
  const jwt = api.calls[0].auth.replace(/^Bearer /, '');
  const [header, claims, signature] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url').toString()), {
    alg: 'RS256',
    typ: 'JWT',
  });
  const seconds = Math.floor(clock.now() / 1000);
  assert.deepEqual(JSON.parse(Buffer.from(claims, 'base64url').toString()), {
    iat: seconds - 60,
    exp: seconds + 540,
    iss: '123456',
  });
  assert.ok(
    verify(
      'sha256',
      Buffer.from(`${header}.${claims}`),
      publicKey,
      Buffer.from(signature, 'base64url'),
    ),
  );
  // os issues vão com o token da instalação
  assert.equal(api.calls[2].auth, 'Bearer ghs_instalacao');
  assert.equal(api.calls[3].auth, 'Bearer ghs_instalacao');

  // 50 minutos depois, o mesmo token; 56, outro (a cinco minutos de vencer)
  const tokens = () =>
    api.calls.filter(call => call.url.endsWith('/access_tokens')).length;
  clock.advance(50 * 60 * 1000);
  await tracker.getIssue(31);
  assert.equal(tokens(), 1);
  clock.advance(6 * 60 * 1000);
  await tracker.getIssue(31);
  assert.equal(tokens(), 2);
  // a instalação foi perguntada uma vez só
  assert.equal(
    api.calls.filter(call => call.url.endsWith('/installation')).length,
    1,
  );
});

test('creating, listing and the count comment, edited only when the app wrote it', async () => {
  const comments = [
    // alguém copiou a marca: não é do app
    { id: 1, body: '<!-- marca --> copiado', performed_via_github_app: null },
    {
      id: 2,
      body: '<!-- marca --> 1 aluno',
      performed_via_github_app: { id: 123456 },
    },
  ];
  const api = fakeApi({
    'POST /app/installations/9/access_tokens': () => [
      201,
      { token: 'ghs_x', expires_at: '2100-01-01T00:00:00Z' },
    ],
    [`POST /repos/${REPO}/issues`]: () => [201, issue(40)],
    [`GET /repos/${REPO}/issues`]: () => [
      200,
      [issue(40), issue(41, { pull_request: { url: 'x' } })],
    ],
    [`GET /repos/${REPO}/issues/40/comments`]: () => [200, comments],
    [`PATCH /repos/${REPO}/issues/comments/2`]: () => [200, {}],
    [`GET /repos/${REPO}/issues/41/comments`]: () => [
      200,
      comments.slice(0, 1),
    ],
    [`POST /repos/${REPO}/issues/41/comments`]: () => [201, {}],
  });
  const tracker = createGitHubIssueTracker(
    { appId: '123456', privateKey, repository: REPO, installationId: '9' },
    { fetch: api.fetch },
  );

  const created = await tracker.createIssue({
    title: '[Sugestão] Ideia',
    body: 'corpo',
    labels: ['enhancement', 'sugestão do app', 'área: RID'],
  });
  assert.equal(created.number, 40);
  assert.deepEqual(
    api.calls.find(call => call.url === `/repos/${REPO}/issues`)?.body,
    {
      title: '[Sugestão] Ideia',
      body: 'corpo',
      labels: ['enhancement', 'sugestão do app', 'área: RID'],
    },
  );

  const open = await tracker.listOpen('enhancement');
  assert.deepEqual(
    open.map(item => [item.number, item.pullRequest]),
    [
      [40, false],
      [41, true],
    ],
  );
  assert.match(
    api.calls.find(call => call.url.startsWith(`/repos/${REPO}/issues?`))!.url,
    /state=open&labels=enhancement&sort=updated/,
  );

  await tracker.upsertComment(40, '<!-- marca -->', 'novo');
  const patched = api.calls.find(call => call.method === 'PATCH');
  assert.equal(patched?.url, `/repos/${REPO}/issues/comments/2`);
  assert.deepEqual(patched?.body, { body: 'novo' });
  // só o copiado: escreve um comentário do app
  await tracker.upsertComment(41, '<!-- marca -->', 'novo');
  assert.ok(
    api.calls.some(
      call =>
        call.method === 'POST' &&
        call.url === `/repos/${REPO}/issues/41/comments`,
    ),
  );
});

test('a GitHub that refuses or does not answer is unavailable, never a crash', async () => {
  const refusing = fakeApi({
    'POST /app/installations/9/access_tokens': () => [
      401,
      { message: 'A JSON web token could not be decoded' },
    ],
  });
  const tracker = createGitHubIssueTracker(
    { appId: '1', privateKey, repository: REPO, installationId: '9' },
    { fetch: refusing.fetch },
  );
  await assert.rejects(
    tracker.getIssue(1),
    (err: unknown) =>
      err instanceof DomainError && err.code === 'github_unavailable',
  );

  const offline = createGitHubIssueTracker(
    { appId: '1', privateKey, repository: REPO, installationId: '9' },
    {
      fetch: async () => {
        throw new TypeError('fetch failed');
      },
    },
  );
  await assert.rejects(
    offline.listOpen('enhancement'),
    (err: unknown) =>
      err instanceof DomainError && err.code === 'github_unavailable',
  );
});
