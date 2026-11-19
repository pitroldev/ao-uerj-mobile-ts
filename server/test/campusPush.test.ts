import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import http2, {
  type Http2Session,
  type IncomingHttpHeaders,
  type ServerHttp2Stream,
} from 'node:http2';
import type { AddressInfo } from 'node:net';
import { after, test } from 'node:test';

import {
  apnsWakePayload,
  createApnsSender,
} from '../src/adapters/outbound/push/apns.ts';
import { createServer, type Server } from '../src/composition.ts';
import { createCampusNow } from '../src/modules/campus-now/application.ts';
import {
  emptyContributor,
  type NoticeRequest,
} from '../src/modules/campus-now/domain.ts';
import {
  clockText,
  confirmedText,
  isQuietTime,
  levelText,
  placeText,
  thanksText,
  WAKE_INTERVAL_MS,
} from '../src/modules/campus-now/push.ts';
import { createPortalWatch } from '../src/modules/portal/application.ts';
import { DomainError } from '../src/shared/errors.ts';
import type {
  PushDevice,
  PushMessage,
  PushResult,
  PushSender,
  WakeMessage,
} from '../src/shared/push.ts';
import {
  manualClock,
  memoryAttachments,
  memoryCampusNow,
  memoryRepositories,
  silentLogger,
  switchableDatabase,
  testConfig,
} from './support.ts';
import { privateKeyEntry, signingKeys } from './tokens.ts';

/*
 * O Agora no campus em segundo plano no iPhone: os avisos de quem avisou por
 * push (nas palavras do app), o push silencioso do "ainda está lá?", o
 * registro do aparelho e as rotas da v2.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const TOKEN = 'ab'.repeat(32);
const OTHER_TOKEN = 'cd'.repeat(32);
const DEVICE: PushDevice = { platform: 'ios', token: TOKEN };

/** Segunda, 23/11/2026, 14h10 em São Paulo. */
const MONDAY = Date.UTC(2026, 10, 23, 17, 10);
/** A mesma segunda, 22h30 em São Paulo. */
const NIGHT = Date.UTC(2026, 10, 24, 1, 30);

const marina = { studentId: 'marina' };
const lucas = { studentId: 'lucas' };
const ana = { studentId: 'ana' };

const lift = (status = 'long_queue'): NoticeRequest =>
  ({
    kind: 'elevators',
    status,
    place: { type: 'elevators' },
  }) as NoticeRequest;

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (err: unknown) => (err instanceof DomainError ? err.code : String(err)),
  );

/** Deixa terminar os envios que ninguém esperou. */
const settle = async () => {
  for (let round = 0; round < 3; round++)
    await new Promise(resolve => setImmediate(resolve));
};

/** O push de mentira: guarda os alertas e os silenciosos. */
function fakePush(results: PushResult[] = []) {
  const alerts: { device: PushDevice; message: PushMessage }[] = [];
  const wakes: { device: PushDevice; message: WakeMessage }[] = [];
  const sender: PushSender = {
    async send(device, message) {
      alerts.push({ device, message });
      return results.shift() ?? 'sent';
    },
    async wake(device, message) {
      wakes.push({ device, message });
      return results.shift() ?? 'sent';
    },
  };
  return { alerts, wakes, sender };
}

function campusAt(start = MONDAY, push: PushSender | null = null) {
  const clock = manualClock(start);
  const memory = memoryCampusNow();
  const errors: unknown[] = [];
  const campus = createCampusNow({
    notices: memory.noticeRepository,
    answers: memory.answerRepository,
    contributors: memory.contributorRepository,
    days: memory.dayRepository,
    pushDevices: memory.pushDeviceRepository,
    push,
    onPushError: err => errors.push(err),
    now: clock.now,
    listCacheMs: 0,
  });
  return { clock, memory, campus, errors };
}

/* ------------------------------------------------------- as palavras do app */

test('the pushes say what the app says (campusNowText.ts), with the time of São Paulo', () => {
  assert.deepEqual(
    confirmedText({
      kind: 'elevators',
      status: 'long_queue',
      place: { type: 'elevators' },
    }),
    {
      title: 'Seu aviso foi confirmado',
      body: 'Elevadores: fila de 10 min ou mais: Hall dos elevadores, bloco C. Agora vale para todo mundo.',
    },
  );
  // 12h05 em São Paulo
  assert.deepEqual(
    thanksText({
      kind: 'ru',
      status: 'long_queue',
      createdAt: new Date(Date.UTC(2026, 10, 23, 15, 5)),
      thanks: 3,
      views: 41,
    }),
    {
      title: '3 colegas agradeceram seu aviso',
      body: 'Fila grande no bandejão, às 12:05. 41 pessoas viram antes de ir.',
    },
  );
  assert.deepEqual(
    thanksText({
      kind: 'power',
      status: 'no_power',
      createdAt: new Date(Date.UTC(2026, 10, 23, 12, 5)),
      thanks: 1,
      views: 1,
    }),
    {
      title: '1 colega agradeceu seu aviso',
      body: 'Sem luz, às 9:05. 1 pessoa viu antes de ir.',
    },
  );
  assert.deepEqual(levelText(3), {
    title: 'Nível 3: Olho no campus',
    body: 'Seus avisos agora valem direto, sem esperar confirmação. Valeu por cuidar do campus.',
  });
  assert.deepEqual(levelText(2), {
    title: 'Nível 2: Na área',
    body: 'Valeu por cuidar do campus.',
  });
  // os lugares como o app (o admin diz menos: sem a rua, "subsolo")
  assert.equal(
    placeText({ type: 'gate', gate: 'portao-metro' }),
    'Portão 1, Radial Oeste, do metrô',
  );
  assert.equal(
    placeText({ type: 'floor', block: 'F', floor: 'SE' }),
    'Bloco F, semienterrado',
  );
  assert.equal(
    placeText({ type: 'floor', block: 'B', floor: 'T' }),
    'Bloco B, térreo',
  );
  assert.equal(
    placeText({ type: 'room', block: 'B', floor: '6', room: '6019' }),
    'Sala 6019, bloco B',
  );
  assert.equal(clockText(new Date(Date.UTC(2026, 10, 24, 2, 0))), '23:00');
});

test('no push from 22h to 7h in São Paulo', () => {
  const at = (hour: number, minute = 0) =>
    new Date(Date.UTC(2026, 10, 23, hour + 3, minute));
  assert.equal(isQuietTime(at(21, 59)), false);
  assert.equal(isQuietTime(at(22)), true);
  assert.equal(isQuietTime(at(6, 59)), true);
  assert.equal(isQuietTime(at(7)), false);
});

/* ----------------------------------------------------------- caso de uso */

test('the reporter hears of the first confirmation once, and the iPhones wake up', async () => {
  const push = fakePush();
  const { campus } = campusAt(MONDAY, push.sender);
  await campus.registerPush(DEVICE, marina);
  await campus.registerPush({ platform: 'ios', token: OTHER_TOKEN }, ana);
  const posted = await campus.report(lift(), marina);
  await settle();
  assert.equal(push.alerts.length, 0);

  await campus.answer(posted.notice.id, 'confirm', lucas);
  await settle();
  assert.equal(push.alerts.length, 1);
  assert.deepEqual(push.alerts[0], {
    device: DEVICE,
    message: {
      title: 'Seu aviso foi confirmado',
      body: 'Elevadores: fila de 10 min ou mais: Hall dos elevadores, bloco C. Agora vale para todo mundo.',
      thread: 'campus',
      collapseId: `campus-confirmed-${posted.notice.id}`,
      target: 'campus',
      expiresAt: push.alerts[0]?.message.expiresAt,
    },
  });
  // os dois iPhones registrados acordam, sem alerta nem som
  assert.deepEqual(
    push.wakes.map(item => item.device.token).sort(),
    [TOKEN, OTHER_TOKEN].sort(),
  );
  assert.deepEqual(push.wakes[0]?.message.wake, { campus: 'wake' });
  assert.equal(
    push.wakes[0]?.message.expiresAt.getTime(),
    MONDAY + 15 * MINUTE,
  );

  // a segunda confirmação não avisa de novo, nem acorda antes da meia hora
  await campus.answer(posted.notice.id, 'confirm', ana);
  await settle();
  assert.equal(push.alerts.length, 1);
  assert.equal(push.wakes.length, 2);
});

test('the level that goes up becomes a push, only to that student', async () => {
  const push = fakePush();
  const { campus, memory } = campusAt(MONDAY, push.sender);
  await campus.registerPush(DEVICE, marina);
  memory.people.set('marina', { ...emptyContributor('marina'), points: 95 });
  await campus.report(lift(), marina);
  await settle();
  assert.deepEqual(
    push.alerts.map(item => [item.message.title, item.message.collapseId]),
    [['Nível 2: Na área', 'campus-level']],
  );
  // sem subir de nível, nada
  await campus.report(lift('stopped'), marina);
  await settle();
  assert.equal(push.alerts.length, 1);
});

test('when the notice ends with thanks, the reporter hears how many, once', async () => {
  const push = fakePush();
  const { campus, clock } = campusAt(MONDAY, push.sender);
  await campus.registerPush(DEVICE, marina);
  const posted = await campus.report(lift(), marina);
  await campus.thank(posted.notice.id, lucas);
  await campus.thank(posted.notice.id, ana);
  await campus.seen([posted.notice.id], lucas);
  // o "Acabou" de quem avisou
  await campus.answer(posted.notice.id, 'end', marina);
  await settle();
  const thanks = push.alerts.filter(item =>
    item.message.collapseId.startsWith('campus-thanks-'),
  );
  assert.deepEqual(
    thanks.map(item => [item.message.title, item.message.body]),
    [
      [
        '2 colegas agradeceram seu aviso',
        'Elevadores: fila de 10 min ou mais, às 14:10. 1 pessoa viu antes de ir.',
      ],
    ],
  );
  // a rodada não manda de novo
  clock.advance(MINUTE);
  await campus.deliverPush();
  await settle();
  assert.equal(
    push.alerts.filter(item =>
      item.message.collapseId.startsWith('campus-thanks-'),
    ).length,
    1,
  );
});

test('a notice that expires by itself gets its thanks in the next round, and a removed one never', async () => {
  const push = fakePush();
  const { campus, clock, memory } = campusAt(MONDAY, push.sender);
  await campus.registerPush(DEVICE, marina);
  // o bandejão com fila pequena vale 30 minutos
  const posted = await campus.report(
    { kind: 'ru', status: 'short_queue', place: { type: 'ru' } },
    marina,
  );
  await campus.thank(posted.notice.id, lucas);
  const flagged = await campus.report(lift('stopped'), marina);
  await campus.thank(flagged.notice.id, lucas);
  await campus.removeByModerator(flagged.notice.id);

  clock.advance(31 * MINUTE);
  await campus.deliverPush();
  await settle();
  const thanks = push.alerts.filter(item =>
    item.message.collapseId.startsWith('campus-thanks-'),
  );
  assert.deepEqual(
    thanks.map(item => item.message.collapseId),
    [`campus-thanks-${posted.notice.id}`],
  );
  assert.ok(memory.notices.get(posted.notice.id)?.thanksToldAt);
  await campus.deliverPush();
  assert.equal(
    push.alerts.filter(item =>
      item.message.collapseId.startsWith('campus-thanks-'),
    ).length,
    1,
  );
});

test('the round wakes each iPhone at most every half hour, only while a notice is confirmed', async () => {
  const push = fakePush();
  const { campus, clock } = campusAt(MONDAY, push.sender);
  await campus.registerPush(DEVICE, marina);
  // nada confirmado: ninguém acorda
  const posted = await campus.report(lift('stopped'), lucas);
  await campus.deliverPush();
  assert.equal(push.wakes.length, 0);

  await campus.answer(posted.notice.id, 'confirm', ana);
  await settle();
  assert.equal(push.wakes.length, 1);
  clock.advance(10 * MINUTE);
  await campus.deliverPush();
  assert.equal(push.wakes.length, 1);
  // meia hora certa ainda não; um minuto depois, sim
  clock.advance(WAKE_INTERVAL_MS - 10 * MINUTE);
  await campus.deliverPush();
  assert.equal(push.wakes.length, 1);
  clock.advance(MINUTE);
  await campus.deliverPush();
  assert.equal(push.wakes.length, 2);
});

test('from 22h to 7h nothing goes out, and the event is not kept for later', async () => {
  const push = fakePush();
  const { campus, clock } = campusAt(NIGHT, push.sender);
  await campus.registerPush(DEVICE, marina);
  const posted = await campus.report(lift(), marina);
  await campus.answer(posted.notice.id, 'confirm', lucas);
  await settle();
  await campus.deliverPush();
  assert.equal(push.alerts.length, 0);
  assert.equal(push.wakes.length, 0);
  // às 7h, a confirmação da noite não avisa
  clock.advance(9 * HOUR);
  await campus.deliverPush();
  await settle();
  assert.equal(push.alerts.length, 0);
});

test('one owner per token, a dead token goes away, and a ban removes the iPhone', async () => {
  const push = fakePush(['gone']);
  const { campus } = campusAt(MONDAY, push.sender);
  await campus.registerPush(DEVICE, marina);
  assert.deepEqual(await campus.pushStatus(marina), {
    available: true,
    registered: true,
  });
  // o mesmo aparelho, outra conta: a anterior não recebe mais
  await campus.registerPush(DEVICE, lucas);
  assert.equal((await campus.pushStatus(marina)).registered, false);
  assert.equal((await campus.pushStatus(lucas)).registered, true);

  // a Apple diz que o token morreu: sai
  const posted = await campus.report(lift(), lucas);
  await campus.answer(posted.notice.id, 'confirm', ana);
  await settle();
  assert.equal((await campus.pushStatus(lucas)).registered, false);

  await campus.registerPush(DEVICE, ana);
  await campus.dropStudent('ana');
  assert.equal((await campus.pushStatus(ana)).registered, false);

  await campus.registerPush(DEVICE, marina);
  await campus.unregisterPush(marina);
  assert.equal((await campus.pushStatus(marina)).registered, false);
});

test('without the APNs key, nothing is registered and nothing goes out', async () => {
  const { campus } = campusAt(MONDAY, null);
  assert.equal(
    await code(campus.registerPush(DEVICE, marina)),
    'push_unavailable',
  );
  assert.deepEqual(await campus.pushStatus(marina), {
    available: false,
    registered: false,
  });
  // sem push, tudo segue
  const posted = await campus.report(lift(), marina);
  await campus.answer(posted.notice.id, 'confirm', lucas);
  await campus.deliverPush();
});

test('a failing push never holds the student who confirmed', async () => {
  const sender: PushSender = {
    send: () => Promise.reject(new Error('apns down')),
    wake: () => Promise.reject(new Error('apns down')),
  };
  const { campus, errors } = campusAt(MONDAY, sender);
  await campus.registerPush(DEVICE, marina);
  const posted = await campus.report(lift(), marina);
  const answered = await campus.answer(posted.notice.id, 'confirm', lucas);
  assert.equal(answered.notice.confirmed, true);
  await settle();
  assert.ok(errors.length >= 1);
});

/* ------------------------------------------------------------------- APNs */

test('APNs gets the silent push in the background, with priority 5 and no alert', async () => {
  const seen: { headers: IncomingHttpHeaders; body: string }[] = [];
  const sessions = new Set<Http2Session>();
  const server = http2.createServer();
  server.on('session', session => sessions.add(session));
  server.on('stream', (stream: ServerHttp2Stream, headers) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => {
      seen.push({ headers, body: Buffer.concat(chunks).toString('utf8') });
      stream.respond({ ':status': 200 });
      stream.end();
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  after(async () => {
    for (const session of sessions) session.destroy();
    await new Promise(resolve => server.close(resolve));
  });
  const { port } = server.address() as AddressInfo;
  const { privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  const sender = createApnsSender({
    keyId: 'ABCDE12345',
    teamId: '4L52AMB8J7',
    privateKey,
    topic: 'com.aouerjmobile',
    environment: 'production',
    origin: `http://127.0.0.1:${port}`,
    now: () => MONDAY,
  });
  const message: WakeMessage = {
    wake: { campus: 'wake' },
    expiresAt: new Date(MONDAY + 15 * MINUTE),
  };
  assert.equal(await sender.wake?.(DEVICE, message), 'sent');
  await sender.close?.();

  const [{ headers, body }] = seen as [(typeof seen)[number]];
  assert.equal(headers[':path'], `/3/device/${TOKEN}`);
  assert.equal(headers['apns-topic'], 'com.aouerjmobile');
  assert.equal(headers['apns-push-type'], 'background');
  assert.equal(headers['apns-priority'], '5');
  assert.equal(headers['apns-collapse-id'], undefined);
  assert.equal(
    headers['apns-expiration'],
    String((MONDAY + 15 * MINUTE) / 1000),
  );
  assert.deepEqual(JSON.parse(body), {
    aps: { 'content-available': 1 },
    campus: 'wake',
  });
  assert.equal(body, apnsWakePayload(message));
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

test('the routes: only with the session, the token checked, 204 to register and to cancel', async () => {
  const { call, signIn, memory } = await serve(fakePush().sender);
  assert.equal((await call('GET', '/campus-now/push')).status, 401);
  const anonymous = await call('POST', '/campus-now/push', { json: {} });
  assert.equal(anonymous.status, 401);
  assert.equal(
    (await call('POST', '/campus-now/push/cancel', { json: {} })).status,
    401,
  );

  const marinaSession = await signIn('201810012345', 'MARINA COSTA');
  const empty = await call('GET', '/campus-now/push', {
    headers: marinaSession,
  });
  assert.equal(empty.status, 200);
  assert.equal(empty.response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(empty.body, { available: true, registered: false });

  for (const json of [
    {},
    { platform: 'android', token: TOKEN },
    { platform: 'ios' },
    { platform: 'ios', token: 'xyz' },
    { platform: 'ios', token: 'ab'.repeat(20) },
    { platform: 'ios', token: 'ab'.repeat(101) },
  ]) {
    const refused = await call('POST', '/campus-now/push', {
      headers: marinaSession,
      json,
    });
    assert.equal(refused.status, 400, JSON.stringify(json));
    assert.equal(refused.body.error, 'invalid_request');
  }

  const registered = await call('POST', '/campus-now/push', {
    headers: marinaSession,
    json: { platform: 'ios', token: TOKEN.toUpperCase() },
  });
  assert.equal(registered.status, 204);
  const [stored] = [...memory.data.campusPushDevices.values()];
  // guardado em minúsculas
  assert.equal(stored?.device.token, TOKEN);
  assert.deepEqual(
    (await call('GET', '/campus-now/push', { headers: marinaSession })).body,
    { available: true, registered: true },
  );

  const cancelled = await call('POST', '/campus-now/push/cancel', {
    headers: marinaSession,
    json: {},
  });
  assert.equal(cancelled.status, 204);
  assert.equal(memory.data.campusPushDevices.size, 0);
  // sem registro, o cancelamento também responde
  assert.equal(
    (
      await call('POST', '/campus-now/push/cancel', {
        headers: marinaSession,
        json: {},
      })
    ).status,
    204,
  );
});

test('the routes without the APNs key: available false and 503 to register', async () => {
  const { call, signIn } = await serve(null);
  const session = await signIn('201810012345', 'MARINA COSTA');
  assert.deepEqual(
    (await call('GET', '/campus-now/push', { headers: session })).body,
    { available: false, registered: false },
  );
  const refused = await call('POST', '/campus-now/push', {
    headers: session,
    json: { platform: 'ios', token: TOKEN },
  });
  assert.equal(refused.status, 503);
  assert.equal(refused.body.error, 'push_unavailable');
});
