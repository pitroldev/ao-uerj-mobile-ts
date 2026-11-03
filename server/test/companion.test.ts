import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { createServer, type Server } from '../src/composition.ts';
import { createCompanion } from '../src/modules/companion/application.ts';
import {
  checkName,
  hasContact,
  memberId,
  planCall,
  type CallRequest,
} from '../src/modules/companion/domain.ts';
import { createPortalWatch } from '../src/modules/portal/application.ts';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  InvalidInputError,
  NotFoundError,
} from '../src/shared/errors.ts';
import {
  manualClock,
  memoryAttachments,
  memoryRepositories,
  silentLogger,
  switchableDatabase,
  testConfig,
} from './support.ts';
import { mintToken, privateKeyEntry, signingKeys } from './tokens.ts';

/*
 * A Companhia agora: as regras (recado sem contato, nome, prazos), os casos
 * de uso com o relógio do teste e as rotas da v2, com o token, o passe e a
 * chave de membro.
 */

const MINUTE = 60 * 1000;

const lunch = (at: Date, extra: Partial<CallRequest> = {}): CallRequest => ({
  kind: 'lunch',
  at,
  spot: 'ru',
  destination: null,
  note: 'Mesa perto da entrada',
  capacity: 3,
  name: 'Júlia',
  ...extra,
});

test('a note carries the meeting, not a contact', () => {
  for (const text of [
    'me chama no 21 99876-5432',
    '(21) 3456 7890',
    'insta @julia',
    'whatsapp na bio',
    'manda zap',
    'https://exemplo.com',
    'vem pelo t.me/grupo',
  ])
    assert.equal(hasContact(text), true, text);
  for (const text of [
    'Mesa perto da entrada, 12:30',
    'Depois da prova de Química; papo leve.',
    'A pé pelo Portão 1',
    'Sala 6019 B até 13:50',
  ])
    assert.equal(hasContact(text), false, text);
});

test('only a first name goes with the call', () => {
  assert.equal(checkName('  Júlia '), 'Júlia');
  assert.equal(checkName("D'Ávila"), "D'Ávila");
  for (const name of ['', 'Ana Paula', 'ana1', '@ana', 'a'.repeat(21)])
    assert.throws(() => checkName(name), InvalidInputError, name);
});

test('a call shows up an hour before, leaves the list after the time and vanishes later', () => {
  const now = new Date(Date.UTC(2026, 10, 23, 15));
  const host = { id: 'h', name: 'Júlia', host: true, joinedAt: now };
  const at = new Date(now.getTime() + 30 * MINUTE);
  const call = planCall(lunch(at), { id: 'c', now, host });
  assert.equal(call.visibleFrom.getTime(), at.getTime() - 60 * MINUTE);
  assert.equal(call.listedUntil.getTime(), at.getTime() + 30 * MINUTE);
  assert.equal(call.expiresAt.getTime(), at.getTime() + 30 * MINUTE);

  const home = planCall(
    {
      ...lunch(at),
      kind: 'home',
      spot: 'concha',
      destination: 'metro',
      capacity: 8,
    },
    { id: 'v', now, host },
  );
  assert.equal(home.listedUntil.getTime(), at.getTime() + 10 * MINUTE);
  assert.equal(home.expiresAt.getTime(), at.getTime() + 120 * MINUTE);

  const refuse = (request: CallRequest) =>
    assert.throws(() => planCall(request, { id: 'x', now, host }));
  // o ponto de encontro de outro tipo, o destino que falta ou sobra
  refuse(lunch(at, { spot: 'portao-5' }));
  refuse({ ...lunch(at), kind: 'home', spot: 'concha', capacity: 4 });
  refuse(lunch(at, { destination: 'metro' }));
  // as vagas e o horário
  refuse(lunch(at, { capacity: 7 }));
  refuse(lunch(at, { capacity: 1 }));
  refuse(lunch(new Date(now.getTime() + 4 * 60 * MINUTE)));
  refuse(lunch(new Date(now.getTime() - 10 * MINUTE)));
  refuse(lunch(at, { note: 'x'.repeat(81) }));
  assert.throws(
    () => planCall(lunch(at, { note: 'chama no zap' }), { id: 'x', now, host }),
    (err: unknown) =>
      err instanceof DomainError && err.code === 'note_not_allowed',
  );
  // o recado numa linha só
  assert.equal(
    planCall(lunch(at, { note: '  mesa \n perto   da entrada ' }), {
      id: 'x',
      now,
      host,
    }).note,
    'mesa perto da entrada',
  );
});

function companionAt(start = Date.UTC(2026, 10, 23, 14, 50)) {
  const clock = manualClock(start);
  const { repositories, data } = memoryRepositories(clock);
  const companion = createCompanion({
    calls: repositories.companionCalls,
    reports: repositories.companionReports,
    now: clock.now,
  });
  return { clock, data, companion };
}

test('open, join until full, leave and the host ending it for everyone', async () => {
  const { clock, companion } = companionAt();
  const at = new Date(clock.now() + 25 * MINUTE);
  const opened = await companion.open(lunch(at));
  assert.equal(opened.memberKey.length, 32);
  assert.deepEqual(opened.call.members, [
    { name: 'Júlia', host: true, you: true },
  ]);

  // quem está fora vê o primeiro nome de quem chamou e quantos vão
  const [listed] = await companion.list();
  assert.equal(listed.host, 'Júlia');
  assert.equal(listed.going, 1);
  assert.equal('members' in listed, false);

  const lucas = await companion.join(opened.call.id, 'Lucas');
  assert.deepEqual(
    lucas.call.members.map(member => [member.name, member.you]),
    [
      ['Júlia', false],
      ['Lucas', true],
    ],
  );
  await companion.join(opened.call.id, 'Bia');
  await assert.rejects(
    companion.join(opened.call.id, 'Renan'),
    (err: unknown) => err instanceof ConflictError && err.code === 'call_full',
  );

  // quem sai libera a vaga; quem não está na chamada não lê
  await companion.leave(opened.call.id, lucas.memberKey);
  await assert.rejects(
    companion.read(opened.call.id, lucas.memberKey),
    ForbiddenError,
  );
  const renan = await companion.join(opened.call.id, 'Renan');
  assert.equal(renan.call.going, 3);

  // quem chamou encerra: sai da lista, e quem estava vê encerrada
  await companion.leave(opened.call.id, opened.memberKey);
  assert.deepEqual(await companion.list(), []);
  const ended = await companion.read(opened.call.id, renan.memberKey);
  assert.ok(ended.endedAt);
  await assert.rejects(
    companion.say(opened.call.id, renan.memberKey, 'on_my_way'),
    (err: unknown) => err instanceof ConflictError && err.code === 'call_ended',
  );
  await assert.rejects(
    companion.join(opened.call.id, 'Tomás'),
    (err: unknown) =>
      err instanceof ConflictError && err.code === 'call_closed',
  );
});

test('the list follows the time: an hour before, until the time passes, then gone', async () => {
  const { clock, companion } = companionAt();
  const at = new Date(clock.now() + 90 * MINUTE);
  const home = await companion.open({
    ...lunch(at),
    kind: 'home',
    spot: 'concha',
    destination: 'trem',
    capacity: 8,
    name: 'Igor',
  });
  assert.deepEqual(await companion.list(), []);
  await assert.rejects(companion.join(home.call.id, 'Ana'), ConflictError);

  clock.advance(31 * MINUTE);
  assert.equal((await companion.list()).length, 1);
  const ana = await companion.join(home.call.id, 'Ana');

  // dez minutos depois da saída, ninguém mais entra; quem foi ainda fala
  clock.advance(70 * MINUTE);
  assert.deepEqual(await companion.list(), []);
  const said = await companion.say(home.call.id, ana.memberKey, 'home_safe');
  assert.deepEqual(
    said.feed.map(entry => [entry.name, entry.phrase, entry.you]),
    [['Ana', 'home_safe', true]],
  );

  // duas horas depois da saída, some de vez
  clock.advance(110 * MINUTE);
  await assert.rejects(
    companion.read(home.call.id, ana.memberKey),
    NotFoundError,
  );
});

test('the phrases are the ready ones, and "Cheguei em casa" only on the way home', async () => {
  const { clock, companion } = companionAt();
  const opened = await companion.open(lunch(new Date(clock.now() + MINUTE)));
  await assert.rejects(
    companion.say(opened.call.id, opened.memberKey, 'home_safe'),
    InvalidInputError,
  );
  const said = await companion.say(opened.call.id, opened.memberKey, 'late');
  assert.equal(said.feed[0].phrase, 'late');
  assert.equal(said.feed[0].you, true);
});

test('three reports take a call down, one per member, and the moderation keeps what it was', async () => {
  const { clock, companion, data } = companionAt();
  const opened = await companion.open(lunch(new Date(clock.now() + MINUTE)));
  const lucas = await companion.join(opened.call.id, 'Lucas');

  await companion.report(
    opened.call.id,
    { memberKey: lucas.memberKey },
    'spam',
  );
  // a mesma pessoa de novo não conta
  await companion.report(
    opened.call.id,
    { memberKey: lucas.memberKey },
    'harassment',
  );
  assert.equal(data.callReports.length, 1);
  await companion.report(opened.call.id, { outsider: true }, 'strange');
  assert.equal((await companion.list()).length, 1);
  await companion.report(opened.call.id, { outsider: true }, 'harassment');
  assert.deepEqual(await companion.list(), []);
  await assert.rejects(
    companion.read(opened.call.id, opened.memberKey),
    NotFoundError,
  );

  const reviewed = await companion.reportsForReview(10);
  assert.deepEqual(
    reviewed.map(report => [report.reason, report.count, report.hidden]),
    [
      ['harassment', 3, true],
      ['strange', 2, false],
      ['spam', 1, false],
    ],
  );
  assert.deepEqual(reviewed[0].names, ['Júlia', 'Lucas']);
  assert.equal(reviewed[0].note, 'Mesa perto da entrada');
  // sem as chaves dos membros
  const stored = JSON.stringify(data.callReports);
  assert.ok(!stored.includes(memberId(lucas.memberKey)));
});

/* ------------------------------------------------------------------- HTTP */

const [key] = signingKeys(1);
const student = { issuer: key, privateKey: key.privateKey, publicKey: key.key };
const token = () => mintToken(student);
const ADMIN = 'a'.repeat(48);
const opened: Server[] = [];

after(async () => {
  await Promise.all(opened.map(server => server.stop()));
});

async function serve() {
  const memory = memoryRepositories();
  const server = createServer(
    testConfig({
      PRIVATE_TOKEN_KEYS: privateKeyEntry(key),
      ADMIN_TOKEN: ADMIN,
    }),
    silentLogger,
    {
      database: switchableDatabase().database,
      repositories: memory.repositories,
      attachments: memoryAttachments().store,
      portal: createPortalWatch({ probe: async () => 200 }),
    },
  );
  opened.push(server);
  const { port } = await server.start(0);
  const base = `http://127.0.0.1:${port}/aouerj/v2/companion`;
  const call = async (
    method: 'GET' | 'POST',
    path: string,
    {
      headers = {},
      body,
    }: { headers?: Record<string, string>; body?: object } = {},
  ) => {
    const init: RequestInit = {
      method,
      headers: { 'content-type': 'application/json', ...headers },
    };
    if (body) init.body = JSON.stringify(body);
    const response = await fetch(`${base}${path}`, init);
    // o corpo como cada passo o confere (como o `Answer` de http.test.ts)
    const json: any = await response.json();
    return { status: response.status, response, json };
  };
  return { call, port, memory };
}

test('the routes: a token opens and joins, the pass reads the list, the member key does the rest', async () => {
  const { call, port } = await serve();
  const at = new Date(Date.now() + 20 * MINUTE).toISOString();

  // sem passe, a lista não abre
  const closed = await call('GET', '/calls');
  assert.equal(closed.status, 401);
  assert.equal(closed.json.error, 'invalid_pass');

  // o passe gasta um token, e um token gasto não vale de novo
  const spent = token();
  const issued = await call('POST', '/pass', {
    headers: { authorization: spent },
  });
  assert.equal(issued.status, 200);
  assert.match(issued.json.pass, /^[A-Za-z0-9_-]{48}$/);
  assert.equal(issued.response.headers.get('cache-control'), 'no-store');
  const again = await call('POST', '/pass', {
    headers: { authorization: spent },
  });
  assert.equal(again.status, 401);
  const pass = { 'x-student-pass': issued.json.pass };
  assert.deepEqual((await call('GET', '/calls', { headers: pass })).json, {
    calls: [],
  });

  // abrir sem token é 401, com token é 201 e devolve a chave
  const request = {
    kind: 'lunch',
    at,
    spot: 'lago',
    note: 'Lanche na sombra',
    capacity: 2,
    name: 'Diego',
  };
  assert.equal((await call('POST', '/calls', { body: request })).status, 401);
  const open = await call('POST', '/calls', {
    headers: { authorization: token() },
    body: request,
  });
  assert.equal(open.status, 201);
  assert.match(open.json.memberKey, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(open.json.call.destination, null);
  assert.deepEqual(open.json.call.members, [
    { name: 'Diego', host: true, you: true },
  ]);
  const id = open.json.call.id as string;
  const host = { 'x-member-key': open.json.memberKey as string };

  // o recado com contato é recusado, com o motivo
  const contact = await call('POST', '/calls', {
    headers: { authorization: token() },
    body: { ...request, note: 'me chama no insta' },
  });
  assert.equal(contact.status, 422);
  assert.equal(contact.json.error, 'note_not_allowed');
  // a entrada inválida diz o campo
  const invalid = await call('POST', '/calls', {
    headers: { authorization: token() },
    body: { ...request, spot: 'casa' },
  });
  assert.equal(invalid.status, 400);
  assert.match(invalid.json.message, /^spot must be one of/);

  const [listed] = (await call('GET', '/calls', { headers: pass })).json
    .calls as Array<Record<string, unknown>>;
  assert.deepEqual(Object.keys(listed).sort(), [
    'at',
    'capacity',
    'destination',
    'expiresAt',
    'going',
    'host',
    'id',
    'kind',
    'listedUntil',
    'note',
    'spot',
  ]);

  // entrar gasta um token; a última vaga é de quem chegou primeiro
  const join = await call('POST', `/calls/${id}/members`, {
    headers: { authorization: token() },
    body: { name: 'Camila' },
  });
  assert.equal(join.status, 201);
  const full = await call('POST', `/calls/${id}/members`, {
    headers: { authorization: token() },
    body: { name: 'Bia' },
  });
  assert.equal(full.status, 409);
  assert.equal(full.json.error, 'call_full');
  const missing = await call('POST', '/calls/nada/members', {
    headers: { authorization: token() },
    body: { name: 'Bia' },
  });
  assert.equal(missing.status, 404);
  assert.equal(missing.json.error, 'call_not_found');

  // a chave de membro lê e manda recado; sem ela, 403
  const camila = { 'x-member-key': join.json.memberKey as string };
  assert.equal((await call('GET', `/calls/${id}`)).status, 403);
  const said = await call('POST', `/calls/${id}/phrases`, {
    headers: camila,
    body: { phrase: 'at_spot' },
  });
  assert.equal(said.status, 200);
  assert.deepEqual(
    said.json.call.feed.map((entry: { name: string }) => entry.name),
    ['Camila'],
  );
  const read = await call('GET', `/calls/${id}`, { headers: host });
  assert.equal(read.json.call.feed[0].you, false);

  // a denúncia de dentro vai com a chave; de fora, com um token
  assert.equal(
    (
      await call('POST', `/calls/${id}/reports`, {
        headers: camila,
        body: { reason: 'spam' },
      })
    ).status,
    200,
  );
  assert.equal(
    (await call('POST', `/calls/${id}/reports`, { body: { reason: 'spam' } }))
      .status,
    401,
  );
  assert.equal(
    (
      await call('POST', `/calls/${id}/reports`, {
        headers: { authorization: token() },
        body: { reason: 'other' },
      })
    ).status,
    200,
  );

  // a administração mostra as denúncias, sem as chaves
  const admin = await fetch(`http://127.0.0.1:${port}/aouerj/admin/companhia`, {
    headers: { authorization: `Bearer ${ADMIN}` },
  });
  assert.equal(admin.status, 200);
  const page = await admin.text();
  assert.match(page, /Denúncias da Companhia agora/);
  assert.match(page, /Mesa no Lago dos Peixinhos/);
  assert.match(page, /Diego, Camila/);
  assert.ok(!page.includes(join.json.memberKey));

  // quem chamou encerra
  const left = await call('POST', `/calls/${id}/leave`, { headers: host });
  assert.deepEqual(left.json, { status: 'ok' });
  assert.deepEqual((await call('GET', '/calls', { headers: pass })).json, {
    calls: [],
  });
});

test('a forged or malformed pass does not read the list', async () => {
  const { call } = await serve();
  for (const forged of ['A'.repeat(48), 'curto', `${'A'.repeat(47)}!`]) {
    const response = await call('GET', '/calls', {
      headers: { 'x-student-pass': forged },
    });
    assert.equal(response.status, 401, forged);
  }
});
