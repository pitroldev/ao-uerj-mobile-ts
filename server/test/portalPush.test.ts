import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, test } from 'node:test';

import { createServer, type Server } from '../src/composition.ts';
import {
  createPortalAlerts,
  createPortalWatch,
} from '../src/modules/portal/application.ts';
import type { PortalStatus } from '../src/modules/portal/domain.ts';
import {
  isQuietTime,
  PORTAL_BACK_TEXT,
  PORTAL_WAKE_INTERVAL_MS,
} from '../src/modules/portal/push.ts';
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
  memoryPortalAlerts,
  memoryRepositories,
  silentLogger,
  switchableDatabase,
  testConfig,
} from './support.ts';
import { privateKeyEntry, signingKeys } from './tokens.ts';

/*
 * Os avisos do portal no iPhone: o "Avisar quando voltar" por push (o
 * servidor testa o portal sozinho) e o cutucão da verificação no portal,
 * com o registro do aparelho e as rotas da v2.
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
/** A terça, 7h05 em São Paulo. */
const MORNING = Date.UTC(2026, 10, 24, 10, 5);

const marina = { studentId: 'marina' };
const lucas = { studentId: 'lucas' };

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (err: unknown) => (err instanceof DomainError ? err.code : String(err)),
  );

/** O relógio manual só anda para a frente: vai até `time`. */
const moveTo = (
  clock: { now(): number; advance(ms: number): void },
  time: number,
) => clock.advance(time - clock.now());

const up = (checkedAt: number): PortalStatus => ({
  state: 'up',
  since: checkedAt,
  checkedAt,
});

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

function alertsAt(
  start = MONDAY,
  push: PushSender | null = null,
  monitoring = true,
) {
  const clock = manualClock(start);
  const memory = memoryPortalAlerts();
  const errors: unknown[] = [];
  const alerts = createPortalAlerts({
    returnAlerts: memory.returnAlertRepository,
    devices: memory.pushDeviceRepository,
    push,
    monitoring,
    onPushError: err => errors.push(err),
    now: clock.now,
  });
  return { alerts, clock, memory, errors };
}

test('the quiet time is 22h to 7h in São Paulo', () => {
  assert.equal(isQuietTime(new Date(MONDAY)), false);
  assert.equal(isQuietTime(new Date(NIGHT)), true);
  assert.equal(isQuietTime(new Date(Date.UTC(2026, 10, 24, 9, 59))), true);
  assert.equal(isQuietTime(new Date(MORNING)), false);
});

test('"Avisar quando voltar": only a portal check after the request tells, once, in the app words', async () => {
  const push = fakePush();
  const { alerts, clock, memory } = alertsAt(MONDAY, push.sender);
  // o teste de antes do pedido não conta: o aluno viu o portal fora depois dele
  const before = up(clock.now());
  clock.advance(MINUTE);
  await alerts.requestReturnAlert(DEVICE, marina);
  assert.deepEqual(await alerts.returnAlertStatus(marina), {
    available: true,
    requested: true,
  });
  assert.equal(await alerts.portalChecked(before), 0);
  // o portal fora também não
  clock.advance(MINUTE);
  assert.equal(
    await alerts.portalChecked({
      state: 'down',
      since: clock.now(),
      checkedAt: clock.now(),
    }),
    0,
  );
  assert.equal(push.alerts.length, 0);

  clock.advance(5 * MINUTE);
  assert.equal(await alerts.portalChecked(up(clock.now())), 1);
  assert.deepEqual(push.alerts, [
    {
      device: DEVICE,
      message: {
        title: 'O Aluno Online voltou',
        body: 'Toque para atualizar seus dados no AO UERJ.',
        thread: 'portal',
        collapseId: 'portal-back',
        target: 'home',
        expiresAt: new Date(clock.now() + 6 * HOUR),
      },
    },
  ]);
  assert.deepEqual(PORTAL_BACK_TEXT, {
    title: 'O Aluno Online voltou',
    body: 'Toque para atualizar seus dados no AO UERJ.',
  });
  // avisou: o pedido acabou
  assert.equal(memory.returnAlerts.size, 0);
  clock.advance(5 * MINUTE);
  assert.equal(await alerts.portalChecked(up(clock.now())), 0);
  assert.equal(push.alerts.length, 1);
});

test('"Avisar quando voltar" waits from 22h to 7h, and the request lasts 3 days', async () => {
  const push = fakePush();
  const { alerts, clock } = alertsAt(NIGHT - HOUR, push.sender);
  await alerts.requestReturnAlert(DEVICE, marina);
  moveTo(clock, NIGHT);
  assert.equal(await alerts.portalChecked(up(clock.now())), 0);
  assert.equal(push.alerts.length, 0);
  moveTo(clock, MORNING);
  assert.equal(await alerts.portalChecked(up(clock.now())), 1);

  // o pedido esquecido some em 3 dias
  await alerts.requestReturnAlert(DEVICE, lucas);
  clock.advance(3 * 24 * HOUR + MINUTE);
  assert.deepEqual(await alerts.returnAlertStatus(lucas), {
    available: true,
    requested: false,
  });
  assert.equal(await alerts.portalChecked(up(clock.now())), 0);
});

test('"Avisar quando voltar" keeps the request when the push fails, and drops the dead token', async () => {
  const push = fakePush(['failed', 'gone']);
  const { alerts, clock, memory } = alertsAt(MONDAY, push.sender);
  await alerts.requestReturnAlert(DEVICE, marina);
  clock.advance(MINUTE);
  assert.equal(await alerts.portalChecked(up(clock.now())), 0);
  // não chegou: fica para o próximo teste
  assert.equal(memory.returnAlerts.size, 1);
  clock.advance(MINUTE);
  assert.equal(await alerts.portalChecked(up(clock.now())), 0);
  // a Apple recusou o token de vez: o pedido vai embora
  assert.equal(memory.returnAlerts.size, 0);
  assert.equal(push.alerts.length, 2);
});

test('"Avisar quando voltar": one request per student, one owner per token, cancelled and banned', async () => {
  const push = fakePush();
  const { alerts, clock, memory } = alertsAt(MONDAY, push.sender);
  await alerts.requestReturnAlert(DEVICE, marina);
  // o mesmo aparelho com outra conta: a anterior não recebe mais
  await alerts.requestReturnAlert(DEVICE, lucas);
  assert.deepEqual([...memory.returnAlerts.keys()], ['lucas']);
  await alerts.cancelReturnAlert(lucas);
  assert.equal(memory.returnAlerts.size, 0);

  await alerts.requestReturnAlert(
    { platform: 'ios', token: OTHER_TOKEN },
    marina,
  );
  await alerts.registerPush(DEVICE, marina);
  await alerts.dropStudent('marina');
  assert.equal(memory.returnAlerts.size, 0);
  assert.equal(memory.pushDevices.size, 0);
  clock.advance(MINUTE);
  assert.equal(await alerts.portalChecked(up(clock.now())), 0);
});

test('two portal checks at once (blue and green) send one push per request', async () => {
  const push = fakePush();
  const { alerts, clock } = alertsAt(MONDAY, push.sender);
  await alerts.requestReturnAlert(DEVICE, marina);
  clock.advance(MINUTE);
  const sent = await Promise.all([
    alerts.portalChecked(up(clock.now())),
    alerts.portalChecked(up(clock.now())),
  ]);
  assert.deepEqual(sent.sort(), [0, 1]);
  assert.equal(push.alerts.length, 1);
});

test('without the APNs key or the portal monitor, "Avisar quando voltar" is off', async () => {
  const noPush = alertsAt(MONDAY, null);
  assert.deepEqual(await noPush.alerts.returnAlertStatus(marina), {
    available: false,
    requested: false,
  });
  assert.equal(
    await code(noPush.alerts.requestReturnAlert(DEVICE, marina)),
    'push_unavailable',
  );
  assert.equal(
    await code(noPush.alerts.registerPush(DEVICE, marina)),
    'push_unavailable',
  );
  assert.equal(await noPush.alerts.wakeDevices(), 0);

  // sem o monitor, o servidor não sabe quando o portal volta; o cutucão segue
  const noMonitor = alertsAt(MONDAY, fakePush().sender, false);
  assert.equal(
    (await noMonitor.alerts.returnAlertStatus(marina)).available,
    false,
  );
  assert.equal(
    await code(noMonitor.alerts.requestReturnAlert(DEVICE, marina)),
    'push_unavailable',
  );
  assert.deepEqual(await noMonitor.alerts.pushStatus(marina), {
    available: true,
    registered: false,
  });
});

test('the nudge: a silent push every 4 hours from 7h to 22h, once even with two rounds', async () => {
  const push = fakePush();
  const { alerts, clock, memory } = alertsAt(MONDAY, push.sender);
  await alerts.registerPush(DEVICE, marina);
  assert.deepEqual(await alerts.pushStatus(marina), {
    available: true,
    registered: true,
  });
  const woken = await Promise.all([alerts.wakeDevices(), alerts.wakeDevices()]);
  assert.deepEqual(woken.sort(), [0, 1]);
  assert.deepEqual(push.wakes, [
    {
      device: DEVICE,
      message: {
        wake: { portal: 'wake' },
        expiresAt: new Date(clock.now() + HOUR),
      },
    },
  ]);
  // antes de 4 horas, nada; o registro de novo não zera o último cutucão
  clock.advance(PORTAL_WAKE_INTERVAL_MS - MINUTE);
  await alerts.registerPush(DEVICE, marina);
  assert.equal(await alerts.wakeDevices(), 0);
  clock.advance(2 * MINUTE);
  assert.equal(await alerts.wakeDevices(), 1);

  // das 22h às 7h, nada
  moveTo(clock, NIGHT + 5 * HOUR);
  assert.equal(await alerts.wakeDevices(), 0);
  moveTo(clock, MORNING);
  assert.equal(await alerts.wakeDevices(), 1);
  assert.equal(push.wakes.length, 3);

  // a Apple recusou o token de vez: o aparelho sai
  const dead = alertsAt(MONDAY, fakePush(['gone']).sender);
  await dead.alerts.registerPush(DEVICE, marina);
  assert.equal(await dead.alerts.wakeDevices(), 0);
  assert.equal(dead.memory.pushDevices.size, 0);

  // um dono por token, e o cancelamento
  await alerts.registerPush(DEVICE, lucas);
  assert.deepEqual([...memory.pushDevices.keys()], ['lucas']);
  await alerts.unregisterPush(lucas);
  assert.equal(memory.pushDevices.size, 0);
});

/* ---------------------------------------------------------------- rotas */

const [key] = signingKeys(1);
const DATA_KEY = randomBytes(32);
const opened: Server[] = [];

after(async () => {
  await Promise.all(opened.map(server => server.stop()));
});

async function serve(push: PushSender | null, portalMonitor = true) {
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
      portalMonitor,
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

const INVALID = [
  {},
  { platform: 'android', token: TOKEN },
  { platform: 'ios' },
  { platform: 'ios', token: 'xyz' },
  { platform: 'ios', token: 'ab'.repeat(20) },
  { platform: 'ios', token: 'ab'.repeat(101) },
];

test('the routes: only with the session, the token checked, 204 to ask and to cancel', async () => {
  const { call, signIn, memory } = await serve(fakePush().sender);
  for (const path of ['/portal/return-alert', '/portal/push']) {
    assert.equal((await call('GET', path)).status, 401, path);
    assert.equal((await call('POST', path, { json: {} })).status, 401, path);
    assert.equal(
      (await call('POST', `${path}/cancel`, { json: {} })).status,
      401,
      path,
    );
  }

  const session = await signIn('201810012345', 'MARINA COSTA');
  const empty = await call('GET', '/portal/return-alert', { headers: session });
  assert.equal(empty.status, 200);
  assert.equal(empty.response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(empty.body, { available: true, requested: false });
  assert.deepEqual(
    (await call('GET', '/portal/push', { headers: session })).body,
    { available: true, registered: false },
  );

  for (const path of ['/portal/return-alert', '/portal/push'])
    for (const json of INVALID) {
      const refused = await call('POST', path, { headers: session, json });
      assert.equal(refused.status, 400, `${path} ${JSON.stringify(json)}`);
      assert.equal(refused.body.error, 'invalid_request');
    }

  const asked = await call('POST', '/portal/return-alert', {
    headers: session,
    json: { platform: 'ios', token: TOKEN.toUpperCase() },
  });
  assert.equal(asked.status, 204);
  // guardado em minúsculas
  assert.equal(
    [...memory.data.portalReturnAlerts.values()][0]?.device.token,
    TOKEN,
  );
  assert.deepEqual(
    (await call('GET', '/portal/return-alert', { headers: session })).body,
    { available: true, requested: true },
  );
  const registered = await call('POST', '/portal/push', {
    headers: session,
    json: { platform: 'ios', token: TOKEN },
  });
  assert.equal(registered.status, 204);
  assert.deepEqual(
    (await call('GET', '/portal/push', { headers: session })).body,
    { available: true, registered: true },
  );

  for (const path of ['/portal/return-alert', '/portal/push']) {
    const cancelled = await call('POST', `${path}/cancel`, {
      headers: session,
      json: {},
    });
    assert.equal(cancelled.status, 204, path);
    // sem nada, o cancelamento também responde
    assert.equal(
      (await call('POST', `${path}/cancel`, { headers: session, json: {} }))
        .status,
      204,
      path,
    );
  }
  assert.equal(memory.data.portalReturnAlerts.size, 0);
  assert.equal(memory.data.portalPushDevices.size, 0);
});

test('the routes without the APNs key or the portal monitor: available false and 503', async () => {
  const noPush = await serve(null);
  const session = await noPush.signIn('201810012345', 'MARINA COSTA');
  assert.deepEqual(
    (await noPush.call('GET', '/portal/return-alert', { headers: session }))
      .body,
    { available: false, requested: false },
  );
  for (const path of ['/portal/return-alert', '/portal/push']) {
    const refused = await noPush.call('POST', path, {
      headers: session,
      json: { platform: 'ios', token: TOKEN },
    });
    assert.equal(refused.status, 503, path);
    assert.equal(refused.body.error, 'push_unavailable');
  }

  const noMonitor = await serve(fakePush().sender, false);
  const other = await noMonitor.signIn('201810012346', 'LUCAS SOUZA');
  assert.deepEqual(
    (await noMonitor.call('GET', '/portal/return-alert', { headers: other }))
      .body,
    { available: false, requested: false },
  );
  assert.equal(
    (
      await noMonitor.call('POST', '/portal/return-alert', {
        headers: other,
        json: { platform: 'ios', token: TOKEN },
      })
    ).status,
    503,
  );
  // o cutucão não depende do monitor
  assert.equal(
    (
      await noMonitor.call('POST', '/portal/push', {
        headers: other,
        json: { platform: 'ios', token: TOKEN },
      })
    ).status,
    204,
  );
});
