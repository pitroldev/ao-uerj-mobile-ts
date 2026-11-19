import assert from 'node:assert/strict';
import {
  generateKeyPairSync,
  randomBytes,
  verify,
  type KeyObject,
} from 'node:crypto';
import http2, {
  type Http2Server,
  type Http2Session,
  type IncomingHttpHeaders,
  type ServerHttp2Stream,
} from 'node:http2';
import type { AddressInfo } from 'node:net';
import { after, test } from 'node:test';

import {
  APNS_TOKEN_TTL_MS,
  apnsPayload,
  createApnsSender,
  type ApnsError,
} from '../src/adapters/outbound/push/apns.ts';
import { createServer, type Server } from '../src/composition.ts';
import { loadConfig } from '../src/config.ts';
import { createCompanion } from '../src/modules/companion/application.ts';
import {
  callForWatch,
  planCall,
  watchMessage,
  type CallRequest,
  type CallWatch,
  type PushDevice,
} from '../src/modules/companion/domain.ts';
import type {
  PushMessage,
  PushResult,
  PushSender,
} from '../src/modules/companion/ports.ts';
import { createPortalWatch } from '../src/modules/portal/application.ts';
import { DomainError } from '../src/shared/errors.ts';
import {
  manualClock,
  memoryAttachments,
  memoryRepositories,
  silentLogger,
  switchableDatabase,
  testConfig,
} from './support.ts';
import { privateKeyEntry, signingKeys } from './tokens.ts';

/*
 * "Me avise se abrirem" no iPhone: o pedido de um push para a janela livre,
 * a chamada que o vira, o envio pelo APNs (HTTP/2 com o JWT ES256) e as
 * rotas da v2, só com a sessão de aluno.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const TOKEN = 'ab'.repeat(32);
const DEVICE: PushDevice = { platform: 'ios', token: TOKEN };

const lunch = (at: Date, extra: Partial<CallRequest> = {}): CallRequest => ({
  kind: 'lunch',
  at,
  spot: 'ru',
  destination: null,
  note: '',
  capacity: 3,
  name: 'Júlia',
  ...extra,
});

const home = (at: Date): CallRequest => ({
  kind: 'home',
  at,
  spot: 'portao-1',
  destination: 'metro',
  note: '',
  capacity: 4,
  name: 'Lucas',
});

/** O push de mentira: guarda o que mandaria e responde o que o teste pedir. */
function fakePush(results: PushResult[] = []) {
  const sent: { device: PushDevice; message: PushMessage }[] = [];
  const sender: PushSender = {
    async send(device, message) {
      sent.push({ device, message });
      return results.shift() ?? 'sent';
    },
  };
  return { sent, sender };
}

const actor = (studentId: string) => ({ studentId });

/** Deixa terminar o envio que quem abriu não esperou. */
const settle = () => new Promise(resolve => setImmediate(resolve));

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (err: unknown) => (err instanceof DomainError ? err.code : String(err)),
  );

/** Segunda, 23/11/2026, 11h50 em São Paulo. */
const MONDAY = Date.UTC(2026, 10, 23, 14, 50);

function companionAt(start = MONDAY, push: PushSender | null = null) {
  const clock = manualClock(start);
  const { repositories, data } = memoryRepositories(clock);
  const errors: unknown[] = [];
  const companion = createCompanion({
    calls: repositories.companionCalls,
    reports: repositories.companionReports,
    watches: repositories.companionCallWatches,
    push,
    onPushError: err => errors.push(err),
    now: clock.now,
  });
  return { clock, data, companion, errors };
}

/* ------------------------------------------------------------------ regras */

test('the push names the kind and the time in São Paulo', () => {
  const host = {
    id: 'h',
    ref: 'r',
    name: 'Júlia',
    host: true,
    joinedAt: new Date(MONDAY),
    student: 's1',
  };
  const now = new Date(MONDAY);
  // 12h30 em São Paulo (15h30 UTC)
  const at = new Date(Date.UTC(2026, 10, 23, 15, 30));
  assert.deepEqual(watchMessage(planCall(lunch(at), { id: 'c1', now, host })), {
    title: 'Abriram uma mesa no seu intervalo',
    body: 'Mesa às 12:30. Toque para ver e sentar junto.',
  });
  // 21h05 em São Paulo é 00h05 UTC do dia seguinte
  const late = new Date(Date.UTC(2026, 10, 24, 0, 5));
  assert.deepEqual(
    watchMessage(
      planCall(home(late), {
        id: 'c2',
        now: new Date(late.getTime() - HOUR),
        host,
      }),
    ),
    {
      title: 'Abriram um grupo para voltar',
      body: 'Saída às 21:05. Toque para ver e entrar no grupo.',
    },
  );
});

test('the call for a request: the kind, up to the time, with a seat, not seen and not his', () => {
  const now = new Date(MONDAY);
  const member = (student: string, host = false) => ({
    id: `m-${student}`,
    ref: 'r',
    name: 'Ana',
    host,
    joinedAt: now,
    student,
  });
  const call = (id: string, request: CallRequest, student = 'other') =>
    planCall(request, { id, now, host: member(student, true) });
  const watch: CallWatch = {
    student: 'me',
    kind: 'lunch',
    until: new Date(MONDAY + HOUR),
    seen: ['seen'],
    device: DEVICE,
    createdAt: now,
  };
  const at = (minutes: number) => new Date(MONDAY + minutes * MINUTE);
  const full = call('full', lunch(at(20), { capacity: 2 }));
  full.members.push(member('third'));
  const mineAsMember = call('joined', lunch(at(10)));
  mineAsMember.members.push(member('me'));

  assert.equal(callForWatch(watch, []), null);
  assert.equal(
    callForWatch(watch, [
      call('home', home(at(10))),
      call('late', lunch(at(61))),
      call('seen', lunch(at(15))),
      call('mine', lunch(at(15)), 'me'),
      mineAsMember,
      full,
    ]),
    null,
  );
  // o horário igual ao `until` ainda vale; com várias, a mais cedo
  assert.equal(
    callForWatch(watch, [
      call('edge', lunch(at(60))),
      call('early', lunch(at(30))),
    ])?.id,
    'early',
  );
});

/* ------------------------------------------------------------ caso de uso */

test('one push per request when someone else opens a call that fits, and the request ends', async () => {
  const push = fakePush();
  const { clock, companion, data } = companionAt(MONDAY, push.sender);
  assert.deepEqual(await companion.watchStatus(actor('marina')), {
    available: true,
    watch: null,
  });
  const until = new Date(MONDAY + 2 * HOUR);
  assert.deepEqual(
    await companion.watch(actor('marina'), {
      kind: 'lunch',
      until,
      seen: ['old', 'old'],
      device: DEVICE,
    }),
    { kind: 'lunch', until },
  );
  assert.deepEqual(data.callWatches.get('marina')?.seen, ['old']);
  assert.deepEqual(await companion.watchStatus(actor('marina')), {
    available: true,
    watch: { kind: 'lunch', until },
  });

  // a volta não é o almoço; a dela mesma não avisa
  await companion.open(home(new Date(MONDAY + 20 * MINUTE)), actor('lucas'));
  await companion.open(lunch(new Date(MONDAY + 20 * MINUTE)), actor('marina'));
  await settle();
  assert.equal(push.sent.length, 0);

  const opened = await companion.open(
    lunch(new Date(MONDAY + 25 * MINUTE)),
    actor('julia'),
  );
  await settle();
  assert.equal(push.sent.length, 1);
  const [{ device, message }] = push.sent;
  assert.deepEqual(device, DEVICE);
  assert.deepEqual(message, {
    title: 'Abriram uma mesa no seu intervalo',
    body: 'Mesa às 12:15. Toque para ver e sentar junto.',
    thread: 'companion',
    collapseId: 'companion-watch',
    target: 'companion',
    expiresAt: new Date(opened.call.listedUntil),
  });
  assert.equal(data.callWatches.size, 0);
  assert.equal((await companion.watchStatus(actor('marina'))).watch, null);

  // outra chamada não manda outro aviso
  clock.advance(MINUTE);
  await companion.open(lunch(new Date(MONDAY + 30 * MINUTE)), actor('bia'));
  await settle();
  assert.equal(await companion.deliverWatches(), 0);
  assert.equal(push.sent.length, 1);
});

test('a call opened hours ahead waits for the list; seen calls and full calls do not count', async () => {
  const push = fakePush();
  const { clock, companion } = companionAt(MONDAY, push.sender);
  const seen = await companion.open(
    lunch(new Date(MONDAY + 30 * MINUTE)),
    actor('julia'),
  );
  await companion.watch(actor('marina'), {
    kind: 'lunch',
    until: new Date(MONDAY + 6 * HOUR),
    seen: [seen.call.id],
    device: DEVICE,
  });
  // às 14h50 UTC, uma mesa às 17h50 aparece na lista só às 16h50
  await companion.open(lunch(new Date(MONDAY + 3 * HOUR)), actor('lucas'));
  await settle();
  assert.equal(push.sent.length, 0);
  assert.equal(await companion.deliverWatches(), 0);

  clock.advance(2 * HOUR + MINUTE);
  assert.equal(await companion.deliverWatches(), 1);
  assert.equal(push.sent.length, 1);
  assert.match(push.sent[0].message.body, /^Mesa às 14:50\./);
});

test('a push that did not go out comes back for the next round; a dead token goes away', async () => {
  const push = fakePush(['failed', 'sent', 'gone']);
  const { companion, data } = companionAt(MONDAY, push.sender);
  const request = {
    kind: 'lunch' as const,
    until: new Date(MONDAY + HOUR),
    seen: [],
    device: DEVICE,
  };
  await companion.watch(actor('marina'), request);
  await companion.open(lunch(new Date(MONDAY + 20 * MINUTE)), actor('julia'));
  await settle();
  assert.equal(push.sent.length, 1);
  assert.ok(data.callWatches.has('marina'));
  assert.equal(await companion.deliverWatches(), 1);
  assert.equal(push.sent.length, 2);
  assert.equal(data.callWatches.size, 0);

  await companion.watch(actor('marina'), request);
  assert.equal(await companion.deliverWatches(), 0);
  assert.equal(push.sent.length, 3);
  assert.equal(data.callWatches.size, 0);
});

test('a throwing sender does not reach whoever opened, and two rounds at once push once', async () => {
  const throwing = companionAt(MONDAY, {
    async send() {
      throw new Error('boom');
    },
  });
  await throwing.companion.watch(actor('marina'), {
    kind: 'lunch',
    until: new Date(MONDAY + HOUR),
    seen: [],
    device: DEVICE,
  });
  const opened = await throwing.companion.open(
    lunch(new Date(MONDAY + 20 * MINUTE)),
    actor('julia'),
  );
  assert.equal(opened.call.going, 1);
  await settle();
  assert.equal(throwing.errors.length, 1);
  // o pedido volta para a próxima rodada
  assert.ok(throwing.data.callWatches.has('marina'));

  const push = fakePush();
  const { companion } = companionAt(MONDAY, push.sender);
  await companion.open(lunch(new Date(MONDAY + 20 * MINUTE)), actor('julia'));
  await settle();
  await companion.watch(actor('marina'), {
    kind: 'lunch',
    until: new Date(MONDAY + HOUR),
    seen: [],
    device: DEVICE,
  });
  const rounds = await Promise.all([
    companion.deliverWatches(),
    companion.deliverWatches(),
    companion.deliverWatches(),
  ]);
  assert.equal(
    rounds.reduce((sum, value) => sum + value, 0),
    1,
  );
  assert.equal(push.sent.length, 1);
});

test('the window, a new request in place of the old one, cancel, ban and no push at all', async () => {
  const push = fakePush();
  const { clock, companion, data } = companionAt(MONDAY, push.sender);
  const ask = (until: number, kind: 'lunch' | 'home' = 'lunch') =>
    companion.watch(actor('marina'), {
      kind,
      until: new Date(until),
      seen: [],
      device: DEVICE,
    });
  assert.equal(await code(ask(MONDAY - MINUTE)), 'invalid_window');
  assert.equal(await code(ask(MONDAY)), 'invalid_window');
  assert.equal(await code(ask(MONDAY + 24 * HOUR + 1)), 'invalid_window');
  assert.equal(await code(ask(Number.NaN)), 'invalid_window');
  assert.equal(await code(ask(MONDAY + 24 * HOUR)), 'ok');

  // um pedido por aluno: o novo fica no lugar
  await ask(MONDAY + 2 * HOUR, 'home');
  assert.equal(data.callWatches.size, 1);
  assert.equal(data.callWatches.get('marina')?.kind, 'home');

  // vencido, já não aparece
  clock.advance(2 * HOUR);
  assert.equal((await companion.watchStatus(actor('marina'))).watch, null);

  await ask(clock.now() + HOUR);
  await companion.unwatch(actor('marina'));
  await companion.unwatch(actor('marina'));
  assert.equal(data.callWatches.size, 0);

  await ask(clock.now() + HOUR);
  await companion.dropStudent('marina');
  assert.equal(data.callWatches.size, 0);

  // sem a chave do APNs, o pedido não entra
  const off = companionAt(MONDAY, null);
  assert.deepEqual(await off.companion.watchStatus(actor('marina')), {
    available: false,
    watch: null,
  });
  assert.equal(
    await code(
      off.companion.watch(actor('marina'), {
        kind: 'lunch',
        until: new Date(MONDAY + HOUR),
        seen: [],
        device: DEVICE,
      }),
    ),
    'push_unavailable',
  );
  assert.equal(await off.companion.deliverWatches(), 0);
});

/* ------------------------------------------------------------------- APNs */

type Answer = { status: number; body?: object } | 'hang';

/** Um APNs local (HTTP/2 sem TLS): guarda os pedidos e responde a fila. */
async function fakeApns(answers: Answer[]) {
  const seen: { headers: IncomingHttpHeaders; body: string }[] = [];
  const sessions = new Set<Http2Session>();
  const server: Http2Server = http2.createServer();
  server.on('session', session => sessions.add(session));
  server.on('stream', (stream: ServerHttp2Stream, headers) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => {
      seen.push({ headers, body: Buffer.concat(chunks).toString('utf8') });
      const answer = answers.shift() ?? { status: 200 };
      if (answer === 'hang') return;
      stream.respond({ ':status': answer.status });
      stream.end(answer.body ? JSON.stringify(answer.body) : undefined);
    });
    stream.on('error', () => undefined);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    seen,
    async close() {
      for (const session of sessions) session.destroy();
      await new Promise(resolve => server.close(resolve));
    },
  };
}

const apnsKeys = () => generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

/** O JWT do provedor: o cabeçalho, as declarações e se a assinatura confere. */
function providerToken(authorization: unknown, publicKey: KeyObject) {
  const [scheme, jwt = ''] = String(authorization).split(' ');
  assert.equal(scheme, 'bearer');
  const [header = '', claims = '', signature = ''] = jwt.split('.');
  const decode = (part: string) =>
    JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
  return {
    jwt,
    header: decode(header),
    claims: decode(claims),
    valid: verify(
      'sha256',
      Buffer.from(`${header}.${claims}`),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      Buffer.from(signature, 'base64url'),
    ),
  };
}

const MESSAGE: PushMessage = {
  title: 'Abriram uma mesa no seu intervalo',
  body: 'Mesa às 12:30. Toque para ver e sentar junto.',
  thread: 'companion',
  collapseId: 'companion-watch',
  target: 'companion',
  expiresAt: new Date(Date.UTC(2026, 10, 23, 16)),
};

test('APNs gets the alert over HTTP/2 with a signed provider token it reuses for 40 minutes', async () => {
  const apns = await fakeApns([]);
  after(() => apns.close());
  const { privateKey, publicKey } = apnsKeys();
  const clock = manualClock(MONDAY);
  const sender = createApnsSender({
    keyId: 'ABCDE12345',
    teamId: '4L52AMB8J7',
    privateKey,
    topic: 'com.aouerjmobile',
    environment: 'production',
    origin: apns.origin,
    now: clock.now,
  });
  assert.equal(await sender.send(DEVICE, MESSAGE), 'sent');
  assert.equal(await sender.send(DEVICE, MESSAGE), 'sent');
  clock.advance(APNS_TOKEN_TTL_MS);
  assert.equal(await sender.send(DEVICE, MESSAGE), 'sent');
  await sender.close?.();

  const [first, second, third] = apns.seen;
  const { headers, body } = first;
  assert.equal(headers[':method'], 'POST');
  assert.equal(headers[':path'], `/3/device/${TOKEN}`);
  assert.equal(headers['apns-topic'], 'com.aouerjmobile');
  assert.equal(headers['apns-push-type'], 'alert');
  assert.equal(headers['apns-priority'], '10');
  assert.equal(headers['apns-collapse-id'], 'companion-watch');
  assert.equal(
    headers['apns-expiration'],
    String(MESSAGE.expiresAt.getTime() / 1000),
  );
  assert.deepEqual(JSON.parse(body), {
    aps: {
      alert: { title: MESSAGE.title, body: MESSAGE.body },
      sound: 'default',
      'thread-id': 'companion',
    },
    target: 'companion',
  });
  assert.equal(body, apnsPayload(MESSAGE));

  const token = providerToken(headers.authorization, publicKey);
  assert.equal(token.valid, true);
  assert.deepEqual(token.header, { alg: 'ES256', kid: 'ABCDE12345' });
  assert.deepEqual(token.claims, {
    iss: '4L52AMB8J7',
    iat: MONDAY / 1000,
  });
  assert.equal(
    providerToken(second.headers.authorization, publicKey).jwt,
    token.jwt,
  );
  const renewed = providerToken(third.headers.authorization, publicKey);
  assert.equal(renewed.valid, true);
  assert.equal(renewed.claims.iat, (MONDAY + APNS_TOKEN_TTL_MS) / 1000);
});

test('APNs: a dead token is gone, a refusal or a silent server fails, and the next push still goes', async () => {
  const apns = await fakeApns([
    { status: 410, body: { reason: 'Unregistered' } },
    { status: 400, body: { reason: 'BadDeviceToken' } },
    { status: 400, body: { reason: 'BadCollapseId' } },
    { status: 403, body: { reason: 'ExpiredProviderToken' } },
    { status: 200 },
    'hang',
    { status: 200 },
  ]);
  after(() => apns.close());
  const { privateKey, publicKey } = apnsKeys();
  const clock = manualClock(MONDAY);
  const errors: ApnsError[] = [];
  const sender = createApnsSender({
    keyId: 'ABCDE12345',
    teamId: '4L52AMB8J7',
    privateKey,
    topic: 'com.aouerjmobile',
    environment: 'sandbox',
    origin: apns.origin,
    timeoutMs: 200,
    now: clock.now,
    onError: err => errors.push(err),
  });
  assert.equal(await sender.send(DEVICE, MESSAGE), 'gone');
  assert.equal(await sender.send(DEVICE, MESSAGE), 'gone');
  assert.equal(await sender.send(DEVICE, MESSAGE), 'failed');
  assert.equal(await sender.send(DEVICE, MESSAGE), 'failed');
  // o token do provedor recusado é refeito no envio seguinte
  clock.advance(1000);
  assert.equal(await sender.send(DEVICE, MESSAGE), 'sent');
  assert.equal(
    providerToken(apns.seen[4]?.headers.authorization, publicKey).claims.iat,
    MONDAY / 1000 + 1,
  );
  assert.equal(await sender.send(DEVICE, MESSAGE), 'failed');
  assert.equal(await sender.send(DEVICE, MESSAGE), 'sent');
  await sender.close?.();

  assert.deepEqual(
    errors.map(err => [err.status, err.reason]),
    [
      [400, 'BadCollapseId'],
      [403, 'ExpiredProviderToken'],
      [null, 'timeout'],
    ],
  );
  // o token do aparelho não vai para o log
  assert.ok(errors.every(err => !err.message.includes(TOKEN)));
});

test('APNs: nobody listening is a failure, not an exception', async () => {
  const { privateKey } = apnsKeys();
  const errors: ApnsError[] = [];
  const sender = createApnsSender({
    keyId: 'ABCDE12345',
    teamId: '4L52AMB8J7',
    privateKey,
    topic: 'com.aouerjmobile',
    environment: 'production',
    origin: 'http://127.0.0.1:1',
    onError: err => errors.push(err),
  });
  assert.equal(await sender.send(DEVICE, MESSAGE), 'failed');
  assert.equal(errors.length, 1);
  await sender.close?.();
});

/* -------------------------------------------------------------- configuração */

test('APNs config: the .p8 in one line with \\n, the Team ID and topic defaults, off without the key', () => {
  const { privateKey } = apnsKeys();
  const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const config = loadConfig({
    APNS_KEY_ID: 'ABCDE12345',
    APNS_PRIVATE_KEY: pem.trim().split('\n').join('\\n'),
  });
  assert.ok(config.push.apns);
  assert.equal(config.push.apns.keyId, 'ABCDE12345');
  assert.equal(config.push.apns.teamId, '4L52AMB8J7');
  assert.equal(config.push.apns.topic, 'com.aouerjmobile');
  assert.equal(config.push.apns.environment, 'production');
  assert.equal(config.push.apns.privateKey.asymmetricKeyType, 'ec');

  assert.equal(loadConfig({}).push.apns, null);
  assert.equal(loadConfig({ APNS_KEY_ID: 'ABCDE12345' }).push.apns, null);
  assert.equal(loadConfig({ APNS_PRIVATE_KEY: pem }).push.apns, null);
  assert.equal(
    loadConfig({
      APNS_KEY_ID: 'ABCDE12345',
      APNS_PRIVATE_KEY: pem,
      APNS_ENVIRONMENT: 'sandbox',
    }).push.apns?.environment,
    'sandbox',
  );

  assert.throws(
    () => loadConfig({ APNS_KEY_ID: 'abc', APNS_PRIVATE_KEY: pem }),
    /APNS_KEY_ID/,
  );
  assert.throws(
    () =>
      loadConfig({ APNS_KEY_ID: 'ABCDE12345', APNS_PRIVATE_KEY: 'not a key' }),
    /APNS_PRIVATE_KEY/,
  );
  // uma chave RSA não é a do APNs
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 })
    .privateKey.export({ format: 'pem', type: 'pkcs8' })
    .toString();
  assert.throws(
    () => loadConfig({ APNS_KEY_ID: 'ABCDE12345', APNS_PRIVATE_KEY: rsa }),
    /APNS_PRIVATE_KEY/,
  );
});

/* ------------------------------------------------------------------- HTTP */

const [key] = signingKeys(1);
const DATA_KEY = randomBytes(32);
const opened: Server[] = [];

after(async () => {
  await Promise.all(opened.map(server => server.stop()));
});

async function serve(push: PushSender | null) {
  const memory = memoryRepositories();
  const server = createServer(
    testConfig({
      PRIVATE_TOKEN_KEYS: privateKeyEntry(key),
      TOKEN_ATTESTATION: 'development',
      STUDENT_DATA_KEY: DATA_KEY.toString('base64'),
    }),
    silentLogger,
    {
      database: switchableDatabase().database,
      repositories: memory.repositories,
      attachments: memoryAttachments().store,
      portal: createPortalWatch({ probe: async () => 200 }),
      push,
    },
  );
  opened.push(server);
  const { port } = await server.start(0);
  const call = async (
    method: 'GET' | 'POST',
    path: string,
    {
      headers = {},
      json,
    }: { headers?: Record<string, string>; json?: object } = {},
  ) => {
    const init: RequestInit = {
      method,
      headers: {
        ...(json ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
    };
    if (json) init.body = JSON.stringify(json);
    const response = await fetch(
      `http://127.0.0.1:${port}/aouerj/v2${path}`,
      init,
    );
    const text = await response.text();
    // o corpo como cada passo o confere
    const body: any = text ? JSON.parse(text) : null;
    return { status: response.status, response, body };
  };
  const signIn = async (matricula: string, name: string) => {
    const challenge = await call('GET', '/students/challenge');
    const session = await call('POST', '/students/session', {
      json: {
        challenge: challenge.body.challenge,
        installation: randomBytes(32).toString('base64url'),
        integrityToken: 'development',
        matricula,
        name,
      },
    });
    assert.equal(session.status, 201);
    return { authorization: `Student ${session.body.session}` };
  };
  return { call, signIn, memory };
}

/** Espera o envio que a abertura não segurou. */
async function waitFor(check: () => boolean, ms = 2000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) assert.fail('timed out');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

test('the routes: only with the session, every field checked, and the push when someone opens', async () => {
  const push = fakePush();
  const { call, signIn, memory } = await serve(push.sender);
  assert.equal((await call('GET', '/companion/watch')).status, 401);
  const anonymous = await call('POST', '/companion/watch', { json: {} });
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.body.error, 'session_required');
  assert.equal(
    (await call('POST', '/companion/watch/cancel', { json: {} })).status,
    401,
  );

  const marina = await signIn('201810012345', 'MARINA COSTA');
  const julia = await signIn('201910054321', 'JULIA LIMA');
  const empty = await call('GET', '/companion/watch', { headers: marina });
  assert.equal(empty.status, 200);
  assert.equal(empty.response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(empty.body, { available: true, watch: null });

  const until2h = new Date(Date.now() + 2 * HOUR).toISOString();
  const valid = {
    kind: 'lunch',
    until: until2h,
    seen: [],
    push: { platform: 'ios', token: TOKEN.toUpperCase() },
  };
  for (const [json, error] of [
    [{ ...valid, kind: 'dinner' }, 'invalid_request'],
    [{ ...valid, until: 'tomorrow' }, 'invalid_request'],
    [{ ...valid, seen: 'x' }, 'invalid_request'],
    [
      { ...valid, seen: Array.from({ length: 51 }, (_, i) => `c${i}`) },
      'invalid_request',
    ],
    [{ ...valid, push: undefined }, 'invalid_request'],
    [
      { ...valid, push: { platform: 'android', token: TOKEN } },
      'invalid_request',
    ],
    [{ ...valid, push: { platform: 'ios', token: 'abc' } }, 'invalid_request'],
    [
      { ...valid, push: { platform: 'ios', token: 'zz'.repeat(32) } },
      'invalid_request',
    ],
    [
      { ...valid, until: new Date(Date.now() - MINUTE).toISOString() },
      'invalid_window',
    ],
    [
      { ...valid, until: new Date(Date.now() + 25 * HOUR).toISOString() },
      'invalid_window',
    ],
  ] as const) {
    const refused = await call('POST', '/companion/watch', {
      headers: marina,
      json,
    });
    assert.equal(refused.status, 400, JSON.stringify(json).slice(0, 80));
    assert.equal(refused.body.error, error);
  }

  const asked = await call('POST', '/companion/watch', {
    headers: marina,
    json: valid,
  });
  assert.equal(asked.status, 200);
  assert.deepEqual(asked.body, { watch: { kind: 'lunch', until: until2h } });
  const [stored] = memory.data.callWatches.values();
  // o token guardado é o mesmo, em minúsculas
  assert.equal(stored?.device.token, TOKEN);
  assert.deepEqual(
    (await call('GET', '/companion/watch', { headers: marina })).body,
    { available: true, watch: { kind: 'lunch', until: until2h } },
  );

  // quem pediu abre a própria mesa: não avisa a ela mesma
  const at = new Date(Date.now() + 20 * MINUTE).toISOString();
  const opening = {
    kind: 'lunch',
    at,
    spot: 'ru',
    capacity: 3,
  };
  const own = await call('POST', '/companion/calls', {
    headers: marina,
    json: { ...opening, name: 'Marina' },
  });
  assert.equal(own.status, 201);
  const theirs = await call('POST', '/companion/calls', {
    headers: julia,
    json: { ...opening, name: 'Júlia' },
  });
  assert.equal(theirs.status, 201);
  await waitFor(() => push.sent.length === 1);
  assert.equal(
    push.sent[0]?.message.title,
    'Abriram uma mesa no seu intervalo',
  );
  assert.equal(push.sent[0]?.device.token, TOKEN);
  assert.equal(memory.data.callWatches.size, 0);

  // cancelar responde 204, com ou sem pedido
  await call('POST', '/companion/watch', { headers: marina, json: valid });
  const cancel = await call('POST', '/companion/watch/cancel', {
    headers: marina,
    json: {},
  });
  assert.equal(cancel.status, 204);
  assert.equal(memory.data.callWatches.size, 0);
  assert.equal(
    (await call('POST', '/companion/watch/cancel', { headers: marina })).status,
    204,
  );
});

test('the routes without the APNs key: available is false and a request is a 503', async () => {
  const { call, signIn } = await serve(null);
  const marina = await signIn('201810012345', 'MARINA COSTA');
  assert.deepEqual(
    (await call('GET', '/companion/watch', { headers: marina })).body,
    { available: false, watch: null },
  );
  const refused = await call('POST', '/companion/watch', {
    headers: marina,
    json: {
      kind: 'home',
      until: new Date(Date.now() + HOUR).toISOString(),
      seen: [],
      push: { platform: 'ios', token: TOKEN },
    },
  });
  assert.equal(refused.status, 503);
  assert.equal(refused.body.error, 'push_unavailable');
});
