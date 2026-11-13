import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { after, before, test } from 'node:test';

import type { Request, Response } from 'express';
import { pino } from 'pino';

import { handleError } from '../src/adapters/inbound/http/errors.ts';
import { createServer, type Server } from '../src/composition.ts';
import { createPortalWatch } from '../src/modules/portal/application.ts';
import type { ScheduleSolver } from '../src/modules/schedules/ports.ts';
import { DomainError, UnavailableError } from '../src/shared/errors.ts';
import {
  memoryAttachments,
  memoryRepositories,
  silentLogger,
  switchableDatabase,
  testConfig,
} from './support.ts';

const ADMIN_TOKEN = 'token-de-administracao';

type Answer = { status: number; headers: Headers; body: any };

/** Sobe um servidor com dublês em memória e devolve como chamá-lo. */
async function serve(env: Record<string, string> = {}) {
  const memory = memoryRepositories();
  const attachments = memoryAttachments();
  const db = switchableDatabase();
  const portal = createPortalWatch({
    probe: async () => 503,
    now: () => Date.UTC(2026, 9, 22, 12),
  });
  await portal.check();
  const server = createServer(testConfig(env), silentLogger, {
    database: db.database,
    repositories: memory.repositories,
    attachments: attachments.store,
    portal,
  });
  const { port } = await server.start(0);
  const base = `http://127.0.0.1:${port}`;

  async function call(
    path: string,
    {
      method = 'GET',
      body,
      headers = {},
    }: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
    } = {},
  ): Promise<Answer> {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      body:
        body === undefined || typeof body === 'string'
          ? body
          : JSON.stringify(body),
      redirect: 'manual',
    });
    const text = await response.text();
    const json = response.headers.get('content-type')?.includes('json');
    return {
      status: response.status,
      headers: response.headers,
      body: json && text ? JSON.parse(text) : text || null,
    };
  }

  return { server, call, memory, attachments, db };
}

let app: Awaited<ReturnType<typeof serve>>;
const opened: Server[] = [];

before(async () => {
  // os testes do gerador dividem este servidor; o do limite tem o próprio
  app = await serve({ GENERATOR_RATE_LIMIT_PER_MINUTE: '1000' });
  opened.push(app.server);
});

after(async () => {
  await Promise.all(opened.map(server => server.stop()));
});

const thread = { disciplina: 'IME02-10892', periodo: '2026.2', turma: '1' };

test('the health route answers with the request id, security headers and no x-powered-by', async () => {
  const response = await app.call('/aouerj/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.online, true);
  assert.equal(response.body.database, 'connected');
  assert.ok(!Number.isNaN(Date.parse(response.body.timestamp)));
  assert.match(response.headers.get('x-request-id') ?? '', /^[\w-]{36}$/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-powered-by'), null);
  // o HSTS é do nginx do domínio: daqui valeria para todos os subdomínios
  assert.equal(response.headers.get('strict-transport-security'), null);

  const traced = await app.call('/aouerj/health', {
    headers: { 'x-request-id': 'nginx-123' },
  });
  assert.equal(traced.headers.get('x-request-id'), 'nginx-123');
});

test('the status shows the release and the parts, and is a 503 without the database', async () => {
  const commit = 'a1b2c3d'.padEnd(40, '0');
  const released = await serve({
    RELEASE_COMMIT: commit,
    RELEASE_COLOR: 'green',
  });
  opened.push(released.server);

  const ok = await released.call('/aouerj/status');
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('cache-control'), 'no-store');
  assert.equal(ok.body.status, 'ok');
  assert.equal(ok.body.release.commit, commit);
  assert.equal(ok.body.release.color, 'green');
  // nada que identifique as versões do servidor
  assert.equal('node' in ok.body.release, false);
  assert.ok(ok.body.release.uptimeSeconds >= 0);
  assert.ok(Date.parse(ok.body.release.startedAt) <= Date.now());
  assert.equal(ok.body.database, 'connected');
  assert.equal(ok.body.portal.state, 'down');
  assert.deepEqual(ok.body.generator, { running: 0, queued: 0 });

  released.db.state.ready = false;
  const degraded = await released.call('/aouerj/status');
  assert.equal(degraded.status, 503);
  assert.equal(degraded.body.status, 'degraded');
  assert.equal(degraded.body.database, 'disconnected');

  // fora da implantação automática, sem commit
  const local = await app.call('/aouerj/status');
  assert.deepEqual(
    { commit: local.body.release.commit, color: local.body.release.color },
    { commit: null, color: null },
  );
});

test('the portal status is cached for a minute and needs no database', async () => {
  app.db.state.ready = false;
  try {
    const response = await app.call('/aouerj/portal-status');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=60');
    assert.deepEqual(response.body, {
      state: 'down',
      since: '2026-10-22T12:00:00.000Z',
      checkedAt: '2026-10-22T12:00:00.000Z',
    });
  } finally {
    app.db.state.ready = true;
  }
});

test('the mural answers what the published apps read: 200, the old fields, oldest first', async () => {
  const first = await app.call('/aouerj/messages/post', {
    method: 'POST',
    body: { fullName: '  Ada Lovelace ', ...thread, message: ' Olá ' },
  });
  assert.equal(first.status, 200);
  assert.deepEqual(Object.keys(first.body), [
    '_id',
    'fullName',
    'disciplina',
    'periodo',
    'turma',
    'message',
    'createdAt',
    'updatedAt',
  ]);
  assert.equal(first.body.fullName, 'Ada Lovelace');
  assert.equal(first.body.message, 'Olá');

  // apps antigos mandavam a turma como número
  await app.call('/aouerj/messages/post', {
    method: 'POST',
    body: { fullName: 'Bea', ...thread, turma: 1, message: 'Segunda' },
  });

  const listed = await app.call('/aouerj/messages/get', {
    method: 'POST',
    body: { ...thread, turma: 1 },
  });
  assert.equal(listed.status, 200);
  assert.deepEqual(
    listed.body.map((message: { message: string }) => message.message),
    ['Olá', 'Segunda'],
  );
});

test('a mural message with a missing or long field is refused with the old messages', async () => {
  const missing = await app.call('/aouerj/messages/post', {
    method: 'POST',
    body: { ...thread, message: 'Oi' },
  });
  assert.equal(missing.status, 400);
  assert.deepEqual(missing.body, {
    error: 'invalid_request',
    message: 'fullName is required',
  });

  // o que o servidor antigo aceitava passa: nome longo do portal e o texto
  // sem corte dos apps 1.x
  const generous = await app.call('/aouerj/messages/post', {
    method: 'POST',
    body: {
      fullName: 'N'.repeat(150),
      ...thread,
      message: 'x'.repeat(5000),
    },
  });
  assert.equal(generous.status, 200);

  const long = await app.call('/aouerj/messages/post', {
    method: 'POST',
    body: { fullName: 'Ada', ...thread, message: 'x'.repeat(10001) },
  });
  assert.equal(long.body.message, 'message must be at most 10000 characters');

  const wrongType = await app.call('/aouerj/messages/get', {
    method: 'POST',
    body: { ...thread, periodo: ['2026.2'] },
  });
  assert.equal(wrongType.body.message, 'periodo must be a string');

  const noBody = await app.call('/aouerj/messages/get', { method: 'POST' });
  assert.equal(noBody.body.message, 'disciplina is required');
});

test('the teacher list is sorted and the search returns the stored shape', async () => {
  app.memory.data.teachers.push(
    {
      id: 't1',
      name: 'Zélia Souza',
      subjects: { '10892': { disciplina: 'Sistemas', turmas: [{ turma: 1 }] } },
      createdAt: new Date(Date.UTC(2024, 0, 1)),
    },
    { id: 't2', name: 'Álvaro Lima', subjects: {} },
  );

  const list = await app.call('/aouerj/docentes');
  assert.deepEqual(list.body, { docentes: ['Álvaro Lima', 'Zélia Souza'] });

  const search = await app.call('/aouerj/docentes/z%C3%A9lia');
  assert.deepEqual(search.body, {
    docentes: [
      {
        _id: 't1',
        docente: 'Zélia Souza',
        disciplinas: {
          '10892': { disciplina: 'Sistemas', turmas: [{ turma: 1 }] },
        },
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ],
  });

  const short = await app.call('/aouerj/docentes/Z');
  assert.deepEqual(short.body, {
    error: 'invalid_request',
    message: 'name is required',
  });
});

test('an error report keeps the attachments and answers only ok', async () => {
  const response = await app.call('/aouerj/reportError', {
    method: 'POST',
    body: {
      page: 'Notas do Período',
      description: '  Some a P2 ',
      email: 'NAO-E-EMAIL',
      html: ['{"parser":"3"}'],
    },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });

  const [report] = app.memory.data.reports.slice(-1);
  assert.equal(report.description, 'Some a P2');
  // um e-mail inválido sai em vez de derrubar o relato
  assert.equal(report.email, undefined);
  assert.equal(
    app.attachments.files.get(`Notas do Período/${report.attachmentIds[0]}`),
    '{"parser":"3"}',
  );

  for (const [html, message] of [
    ['<main/>', 'html must be an array'],
    [[1], 'each html document must be a string (html[0])'],
    [
      Array.from({ length: 11 }, () => '{}'),
      'html must contain at most 10 documents',
    ],
  ] as const) {
    const refused = await app.call('/aouerj/reportError', {
      method: 'POST',
      body: { page: 'p', html },
    });
    assert.equal(refused.status, 400);
    assert.equal(refused.body.message, message);
  }
});

test('a suggestion from an old app is saved with a valid e-mail in lower case', async () => {
  const response = await app.call('/aouerj/suggestions', {
    method: 'POST',
    body: { name: ' Ada ', content: 'Modo escuro', email: ' ADA@EXAMPLE.COM ' },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
  assert.deepEqual(app.memory.data.suggestions.at(-1), {
    ...app.memory.data.suggestions.at(-1),
    name: 'Ada',
    content: 'Modo escuro',
    email: 'ada@example.com',
  });
});

test('the listings with e-mail do not exist without the admin token', async () => {
  for (const path of ['/aouerj/reportError', '/aouerj/suggestions']) {
    const response = await app.call(path);
    assert.equal(response.status, 404);
  }
});

test('with the admin token configured, the listings need it', async () => {
  const admin = await serve({ ADMIN_TOKEN });
  opened.push(admin.server);
  await admin.call('/aouerj/suggestions', {
    method: 'POST',
    body: { name: 'Ada', content: 'Oi', email: 'ada@example.com' },
  });

  // sem o acesso, a rota responde como se não existisse
  for (const token of ['token-de-administracaX', 'outro']) {
    const refused = await admin.call('/aouerj/suggestions', {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(refused.status, 404);
    assert.deepEqual(refused.body, {
      error: 'not_found',
      message: 'Route not found',
    });
  }
  assert.equal((await admin.call('/aouerj/suggestions')).status, 404);

  const allowed = await admin.call('/aouerj/suggestions', {
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
  });
  assert.equal(allowed.status, 200);
  assert.deepEqual(Object.keys(allowed.body[0]), [
    '_id',
    'name',
    'content',
    'email',
    'createdAt',
    'updatedAt',
  ]);

  const empty = await admin.call('/aouerj/reportError', {
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
  });
  assert.deepEqual(empty.body, { reports: [] });

  await admin.call('/aouerj/reportError', {
    method: 'POST',
    body: {
      page: 'Notas',
      description: 'Sumiu a nota',
      email: 'ada@example.com',
      html: ['<html></html>'],
    },
  });
  const reports = await admin.call('/aouerj/reportError', {
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
  });
  assert.equal(reports.status, 200);
  const [record] = reports.body.reports;
  // os campos do servidor antigo, com as datas em ISO
  assert.deepEqual(Object.keys(record), [
    '_id',
    'page',
    'description',
    'email',
    'filesID',
    'createdAt',
    'updatedAt',
  ]);
  assert.equal(record.page, 'Notas');
  assert.equal(record.filesID.length, 1);
  assert.match(record.createdAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
});

test('without the database, its routes answer 503 at once and the others keep working', async () => {
  app.db.state.ready = false;
  try {
    const startedAt = Date.now();
    const docentes = await app.call('/aouerj/docentes');
    assert.equal(docentes.status, 503);
    assert.equal(docentes.body.error, 'database_unavailable');
    assert.ok(Date.now() - startedAt < 500);

    assert.equal(
      (await app.call('/aouerj/health')).body.database,
      'disconnected',
    );
    assert.equal((await app.call('/aouerj/nada')).status, 404);
  } finally {
    app.db.state.ready = true;
  }
});

test('a database that drops during the request is a 503; any other failure, a 500', async () => {
  const broken = await serve();
  opened.push(broken.server);
  broken.memory.repositories.teachers.listNames = async () => {
    throw new UnavailableError(
      'database_unavailable',
      'The database is temporarily unavailable',
    );
  };
  broken.memory.repositories.messages.listThread = async () => {
    throw new Error('bug');
  };

  assert.equal((await broken.call('/aouerj/docentes')).status, 503);
  const failed = await broken.call('/aouerj/messages/get', {
    method: 'POST',
    body: thread,
  });
  assert.equal(failed.status, 500);
  assert.deepEqual(failed.body, {
    error: 'internal_server_error',
    message: 'Unexpected server error',
  });
});

test('broken and oversized JSON get their own answers', async () => {
  const broken = await app.call('/aouerj/messages/get', {
    method: 'POST',
    body: '{"disciplina":',
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(broken.status, 400);
  assert.equal(broken.body.error, 'invalid_json');

  const large = await app.call('/aouerj/messages/post', {
    method: 'POST',
    body: JSON.stringify({ message: 'x'.repeat(1024 * 1024 + 1) }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(large.status, 413);
  assert.equal(large.body.error, 'payload_too_large');

  // 150 KB: acima do limite antigo de /aouerj, dentro do gerador
  const padding = 'x'.repeat(150 * 1024);
  const report = await app.call('/aouerj/reportError', {
    method: 'POST',
    body: { page: 'Notas', html: [padding] },
  });
  assert.equal(report.status, 413);
  const generation_ = await app.call('/schedules/generate', {
    method: 'POST',
    body: { ...generation(conflictingThree()), padding },
  });
  assert.equal(generation_.status, 200);
});

test('a request the libraries refuse keeps its 4xx instead of a 500', async () => {
  const badPath = await app.call('/aouerj/docentes/%E0%A4%A');
  assert.equal(badPath.status, 400);
  assert.equal(badPath.body.error, 'bad_request');

  const refusals: Record<string, string>[] = [
    { 'content-type': 'application/json; charset=latin1' },
    { 'content-type': 'application/json', 'content-encoding': 'foo' },
  ];
  for (const headers of refusals) {
    const refused = await app.call('/aouerj/messages/get', {
      method: 'POST',
      body: JSON.stringify(thread),
      headers,
    });
    assert.equal(refused.status, 415);
    assert.equal(refused.body.error, 'unsupported_media_type');
  }
});

test('the writes are limited per minute', async () => {
  const limited = await serve({ RATE_LIMIT_PER_MINUTE: '2' });
  opened.push(limited.server);
  const post = () =>
    limited.call('/aouerj/suggestions', {
      method: 'POST',
      body: { name: 'Ada', content: 'Oi' },
    });

  assert.equal((await post()).status, 200);
  assert.equal((await post()).status, 200);
  const third = await post();
  assert.equal(third.status, 429);
  assert.equal(third.body.error, 'rate_limited');
  // a leitura não entra na conta
  assert.equal((await limited.call('/aouerj/docentes')).status, 200);
});

test('HTTPS redirects keep the public origin even for protocol-relative paths', async () => {
  const secure = await serve({
    FORCE_HTTPS: 'true',
    PUBLIC_URL: 'https://pitrol.dev',
    TRUST_PROXY: '1',
  });
  opened.push(secure.server);

  const response = await secure.call('//attacker.example/aouerj/health?x=1');
  assert.equal(response.status, 308);
  // "//attacker.example" lido como origem só cede o caminho e a query
  assert.equal(
    response.headers.get('location'),
    'https://pitrol.dev/aouerj/health?x=1',
  );
  // o que chega pelo proxy em HTTPS passa direto
  const proxied = await secure.call('/aouerj/health', {
    headers: { 'x-forwarded-proto': 'https' },
  });
  assert.equal(proxied.status, 200);
});

/*
 * O gerador de grades. Os casos "the old generator" são os testes que
 * acompanham a produção (tests/reported-bugs.test.cjs na VM), com as mesmas
 * entradas e respostas.
 */

const interval = (day: number, start: number, end: number) => ({
  week_day: day,
  start_time_in_minutes: start,
  end_time_in_minutes: end,
});
const subject = (id: string, credits = 4) => ({
  id,
  name: `Synthetic ${id}`,
  type: 'MANDATORY',
  credits,
  total_workload: credits * 15,
  prerequisites: [],
  allow_conflict: false,
});
const group = (
  id: string,
  schedules: ReturnType<typeof interval>[],
  classId = '1',
) => ({
  id: classId,
  name: `Synthetic ${id}`,
  type: 'REGULAR',
  teachers: [],
  vacancies_amount: 10,
  subject_id: id,
  schedules,
});
type Group = ReturnType<typeof group>;
const generation = (
  classes: Group[],
  preferences: Record<string, unknown> = {},
  subjects: object[] = [...new Set(classes.map(c => c.subject_id))].map(id =>
    subject(id),
  ),
) => ({
  preferences: {
    min_subject_amount: 1,
    max_subject_amount: 3,
    priority: ['MAX_CREDITS'],
    ...preferences,
  },
  classes,
  subjects,
});
type Generated = {
  schedule: { subject_id: string; subject: { credits: number } }[];
  total_credits: number;
};
const generate = async (body: unknown) => {
  const response = await app.call('/schedules/generate', {
    method: 'POST',
    body,
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.exhaustive, true);
  return response.body.data as Generated[];
};
const subjectsOf = (schedule: Generated) =>
  schedule.schedule
    .map(c => c.subject_id)
    .sort()
    .join(',');
const assertRange = (schedules: Generated[], min: number, max: number) => {
  for (const schedule of schedules) {
    assert.ok(
      schedule.schedule.length >= min && schedule.schedule.length <= max,
    );
    assert.equal(
      new Set(schedule.schedule.map(c => c.subject_id)).size,
      schedule.schedule.length,
    );
    assert.equal(
      schedule.total_credits,
      schedule.schedule.reduce((n, c) => n + c.subject.credits, 0),
    );
  }
};
const conflictingThree = () => [
  group('IME01-12345', [interval(0, 420, 520)]),
  group('IME01-12346', [interval(0, 420, 520)]),
  group('IME01-12347', [interval(1, 420, 520)]),
];

test('the old generator: numeric strings and no busy hours still give the pairs', async () => {
  const results = await generate(
    generation(conflictingThree(), {
      min_subject_amount: '2',
      max_subject_amount: '3',
    }),
  );
  assert.deepEqual(results.map(subjectsOf).sort(), [
    'IME01-12345,IME01-12347',
    'IME01-12346,IME01-12347',
  ]);
  assertRange(results, 2, 3);
});

test('the old generator: one- and two-subject schedules, more subjects first', async () => {
  const results = await generate(
    generation(conflictingThree(), { busy_schedules: [] }),
  );
  assert.deepEqual(
    results.map(s => s.schedule.length),
    [2, 2, 1, 1, 1],
  );
  assert.deepEqual(results.map(subjectsOf).sort(), [
    'IME01-12345',
    'IME01-12345,IME01-12347',
    'IME01-12346',
    'IME01-12346,IME01-12347',
    'IME01-12347',
  ]);
});

test('the old generator: single subjects when every pair conflicts and the maximum is twelve', async () => {
  const classes = ['A', 'B', 'C'].map(id => group(id, [interval(0, 420, 520)]));
  const results = await generate(
    generation(classes, { max_subject_amount: 12 }),
  );
  assert.deepEqual(results.map(subjectsOf).sort(), ['A', 'B', 'C']);
  assertRange(results, 1, 12);
});

test('the old generator: exact minimums and maximums', async () => {
  assert.deepEqual(
    await generate(
      generation(conflictingThree(), {
        min_subject_amount: 3,
        max_subject_amount: 3,
      }),
    ),
    [],
  );
  const pairs = await generate(
    generation(conflictingThree(), {
      min_subject_amount: 2,
      max_subject_amount: 2,
    }),
  );
  assert.deepEqual(pairs.map(subjectsOf).sort(), [
    'IME01-12345,IME01-12347',
    'IME01-12346,IME01-12347',
  ]);
});

test('the old generator: busy hours exclude overlaps but not adjacent hours or other days', async () => {
  const classes = [
    group('A', [interval(0, 100, 200)]),
    group('B', [interval(0, 200, 300)]),
    group('C', [interval(0, 0, 100)]),
    group('D', [interval(6, 100, 200)]),
  ];
  const results = await generate(
    generation(classes, { busy_schedules: [interval(0, 100, 200)] }),
  );
  assert.equal(subjectsOf(results[0]), 'B,C,D');
  assert.ok(results.every(s => s.schedule.every(c => c.subject_id !== 'A')));

  const sunday = [
    group('A', [interval(6, 0, 50)]),
    group('B', [interval(6, 1390, 1440)]),
    group('C', [interval(0, 0, 50)]),
  ];
  const free = await generate(
    generation(sunday, { busy_schedules: [interval(6, 0, 1440)] }),
  );
  assert.deepEqual(free.map(subjectsOf), ['C']);
});

test('the old generator: nothing compatible is an empty answer', async () => {
  const classes = [group('A', [interval(0, 100, 200)])];
  assert.deepEqual(
    await generate(
      generation(classes, { busy_schedules: [interval(0, 150, 250)] }),
    ),
    [],
  );
  assert.deepEqual(await generate(generation([], { busy_schedules: [] })), []);
});

test('the old generator: five schedules at most, ranked by credits among equals', async () => {
  const subjects = Array.from({ length: 7 }, (_, i) => subject(`A${i}`, i + 1));
  const classes = subjects.map(s => group(s.id, [interval(0, 100, 200)]));
  const results = await generate(
    generation(classes, { max_subject_amount: 1 }, subjects),
  );
  assert.deepEqual(
    results.map(s => s.total_credits),
    [7, 6, 5, 4, 3],
  );
});

test('the old generator: two classes of a subject never count as two subjects', async () => {
  const classes = [
    group('A', [interval(0, 100, 200)], '1'),
    group('A', [interval(1, 100, 200)], '2'),
    group('B', [interval(2, 100, 200)], '1'),
  ];
  const results = await generate(
    generation(classes, { min_subject_amount: 2, max_subject_amount: 3 }),
  );
  assert.equal(results.length, 2);
  assert.ok(results.every(s => subjectsOf(s) === 'A,B'));
});

test('the old generator: the permission to conflict works in either order, busy hours still win', async () => {
  const classes = [
    group('A', [interval(0, 100, 200)]),
    group('B', [interval(0, 150, 250)]),
  ];
  const allowed = [subject('A'), { ...subject('B'), allow_conflict: true }];
  const pair = { min_subject_amount: 2, max_subject_amount: 2 };
  for (const ordered of [classes, [...classes].reverse()]) {
    assert.deepEqual(
      (await generate(generation(ordered, pair, allowed))).map(subjectsOf),
      ['A,B'],
    );
    assert.deepEqual(await generate(generation(ordered, pair)), []);
  }
  const busy = await generate(
    generation(classes, { busy_schedules: [interval(0, 200, 300)] }, allowed),
  );
  assert.deepEqual(busy.map(subjectsOf), ['A']);
});

test('a generated class is the one sent, extra fields included, plus its subject', async () => {
  const sent = { ...group('A', [interval(0, 100, 200)]), turno: 'M' };
  const response = await app.call('/schedules/generate', {
    method: 'POST',
    body: generation([sent], { priority: ['MIN_GAPS', 'SOMETHING_NEW'] }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    data: [
      {
        hash: 'AxD0-100-200',
        schedule: [{ ...sent, subject: subject('A') }],
        total_week_days: 1,
        total_credits: 4,
        total_workload: 60,
        fails: { subject_amount: false },
        total_gaps_in_minutes: 0,
      },
    ],
    exhaustive: true,
  });
});

test('a malformed generation request is a 400 that says where', async () => {
  const classes = [group('A', [interval(0, 100, 200)])];
  const cases: [unknown, string][] = [
    [{ classes, subjects: [] }, 'preferences is required'],
    [
      generation(classes, { max_subject_amount: 'três' }),
      'max_subject_amount must be an integer (preferences.max_subject_amount)',
    ],
    [
      generation([group('A', [interval(7, 100, 200)])]),
      'week_day must be an integer from 0 to 6 (classes[0].schedules[0].week_day)',
    ],
    [
      generation([group('A', [interval(0, 300, 200)])]),
      'a schedule must end after it starts (classes[0].schedules[0])',
    ],
    [{ ...generation(classes), classes: 'A' }, 'classes must be an array'],
  ];
  for (const [body, message] of cases) {
    const refused = await app.call('/schedules/generate', {
      method: 'POST',
      body,
    });
    assert.equal(refused.status, 400);
    assert.deepEqual(refused.body, { error: 'invalid_request', message });
  }
});

const windowed = () => [
  group('A', [interval(0, 690, 740)]),
  group('B', [interval(0, 740, 800)]),
  group('C', [interval(0, 800, 850)]),
];

test('the lunch break keeps a free slot in the window, and null means none', async () => {
  // sem a regra, as três seguidas são a melhor grade (três disciplinas)
  const open = await generate(generation(windowed()));
  assert.equal(open[0].schedule.length, 3);
  // null vale ausente: nada muda
  const nulled = await generate(generation(windowed(), { lunch_break: null }));
  assert.equal(nulled[0].schedule.length, 3);
  // com 50 min livres entre 690 e 850, não cabem as três
  const lunched = await generate(
    generation(windowed(), {
      lunch_break: {
        start_time_in_minutes: 690,
        end_time_in_minutes: 850,
        minimum_minutes: 50,
      },
    }),
  );
  assert.equal(lunched[0].schedule.length, 2);
  assert.ok(lunched.every(s => s.schedule.length <= 2));
});

test('a malformed lunch break is a 400 that says where', async () => {
  const cases: [Record<string, unknown>, string][] = [
    [
      { end_time_in_minutes: 850, minimum_minutes: 50 },
      'start_time_in_minutes must be a number of minutes (preferences.lunch_break.start_time_in_minutes)',
    ],
    [
      { start_time_in_minutes: 690, minimum_minutes: 50 },
      'end_time_in_minutes must be a number of minutes (preferences.lunch_break.end_time_in_minutes)',
    ],
    [
      { start_time_in_minutes: 690, end_time_in_minutes: 850 },
      'minimum_minutes must be a number of minutes (preferences.lunch_break.minimum_minutes)',
    ],
    [
      {
        start_time_in_minutes: -1,
        end_time_in_minutes: 850,
        minimum_minutes: 50,
      },
      'start_time_in_minutes must be between 0 and 1440 (preferences.lunch_break.start_time_in_minutes)',
    ],
    [
      {
        start_time_in_minutes: 690,
        end_time_in_minutes: 1441,
        minimum_minutes: 50,
      },
      'end_time_in_minutes must be between 0 and 1440 (preferences.lunch_break.end_time_in_minutes)',
    ],
    [
      {
        start_time_in_minutes: 690,
        end_time_in_minutes: 850,
        minimum_minutes: 0,
      },
      'minimum_minutes must be at least 1 (preferences.lunch_break.minimum_minutes)',
    ],
    [
      {
        start_time_in_minutes: 850,
        end_time_in_minutes: 690,
        minimum_minutes: 50,
      },
      'lunch_break must end after it starts (preferences.lunch_break)',
    ],
    [
      {
        start_time_in_minutes: 690,
        end_time_in_minutes: 850,
        minimum_minutes: 200,
      },
      'minimum_minutes must fit within the lunch break (preferences.lunch_break)',
    ],
  ];
  for (const [lunch_break, message] of cases) {
    const refused = await app.call('/schedules/generate', {
      method: 'POST',
      body: generation(windowed(), { lunch_break }),
    });
    assert.equal(refused.status, 400);
    assert.deepEqual(refused.body, { error: 'invalid_request', message });
  }
});

test('the generator health shows its load, and generations are limited per minute', async () => {
  const health = await app.call('/schedules/health');
  assert.equal(health.status, 200);
  assert.deepEqual(health.body, { online: true, running: 0, queued: 0 });

  const limited = await serve({ GENERATOR_RATE_LIMIT_PER_MINUTE: '1' });
  opened.push(limited.server);
  const post = () =>
    limited.call('/schedules/generate', {
      method: 'POST',
      body: generation(conflictingThree()),
    });
  assert.equal((await post()).status, 200);
  const second = await post();
  assert.equal(second.status, 429);
  assert.equal(second.body.error, 'rate_limited');
});

/** O log da requisição em linhas de JSON, para o teste conferir. */
function capturedLogger() {
  const lines: Array<Record<string, unknown>> = [];
  const logger = pino(
    { level: 'warn' },
    new Writable({
      write(chunk, _encoding, done) {
        lines.push(JSON.parse(String(chunk)));
        done();
      },
    }),
  );
  return { logger, lines };
}

/** Um servidor com o solver e o log que o teste der. */
async function serveWith(solver: ScheduleSolver, logger = silentLogger) {
  const server = createServer(testConfig(), logger, {
    database: switchableDatabase().database,
    repositories: memoryRepositories().repositories,
    attachments: memoryAttachments().store,
    portal: createPortalWatch({ probe: async () => 200 }),
    solver,
  });
  opened.push(server);
  const { port } = await server.start(0);
  return `http://127.0.0.1:${port}`;
}

const idle = () => ({ running: 0, queued: 0 });
const postGeneration = (base: string, signal?: AbortSignal) =>
  fetch(`${base}/schedules/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(generation(conflictingThree())),
    signal,
  });

test('a search stopped by the time budget still answers, says so and leaves a warning', async () => {
  const { logger, lines } = capturedLogger();
  const base = await serveWith(
    {
      solve: async () => ({ schedules: [], exhaustive: false, visited: 42 }),
      load: idle,
    },
    logger,
  );
  const response = await postGeneration(base);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: [], exhaustive: false });
  const warning = lines.find(
    line => line.msg === 'schedule search stopped at the time budget',
  );
  assert.equal(warning?.visited, 42);
  assert.equal(warning?.classes, 3);
});

test('when the app gives up, the search is told to stop and nothing fails', async () => {
  const { logger, lines } = capturedLogger();
  let told!: () => void;
  const stopped = new Promise<void>(resolve => (told = resolve));
  const base = await serveWith(
    {
      solve: (_request, { signal } = {}) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener(
            'abort',
            () => {
              told();
              reject(new DOMException('The app gave up', 'AbortError'));
            },
            { once: true },
          );
        }),
      load: idle,
    },
    logger,
  );

  const client = new AbortController();
  const pending = postGeneration(base, client.signal);
  setTimeout(() => client.abort(), 100);
  await assert.rejects(pending, { name: 'AbortError' });
  await stopped;

  // o servidor segue atendendo, e a desistência não virou um 500 no log
  assert.equal((await fetch(`${base}/schedules/health`)).status, 200);
  assert.equal(
    lines.some(line => line.msg === 'request failed'),
    false,
  );
});

test('what old apps send: no pages, empty texts, nulls and an e-mail that is not text', async () => {
  // um relato só com a página, e a descrição vazia
  const report = await app.call('/aouerj/reportError', {
    method: 'POST',
    body: { page: 'Horários', description: '' },
  });
  assert.deepEqual(report.body, { status: 'ok' });
  const saved = app.memory.data.reports.at(-1)!;
  assert.deepEqual(saved.attachmentIds, []);
  assert.equal(saved.description, undefined);

  // um e-mail que não é texto some, em vez de recusar a sugestão
  await app.call('/aouerj/suggestions', {
    method: 'POST',
    body: { name: 'Ana', content: 'Oi', email: 12345 },
  });
  assert.equal(app.memory.data.suggestions.at(-1)!.email, undefined);

  // nulo num campo obrigatório é o mesmo que faltar
  const refused = await app.call('/aouerj/messages/post', {
    method: 'POST',
    body: { ...thread, fullName: null, message: 'Oi' },
  });
  assert.equal(refused.status, 400);
  assert.equal(refused.body.message, 'fullName is required');

  app.memory.data.teachers.push({
    id: 't-datas',
    name: 'Yara Datas',
    subjects: {},
    createdAt: new Date(Date.UTC(2023, 0, 1)),
    updatedAt: new Date(Date.UTC(2024, 0, 1)),
  });
  const found = await app.call('/aouerj/docentes/yara');
  assert.equal(found.body.docentes[0].updatedAt, '2024-01-01T00:00:00.000Z');
});

test('the generator takes nulls as absent and numbers as text, as the old apps send', async () => {
  const [first, ...others] = conflictingThree();
  const body = generation([
    { ...first, id: 7 as unknown as string, name: null as unknown as string },
    ...others,
  ]);
  body.subjects = body.subjects.map(entry => ({
    ...entry,
    recomended_period: null,
  }));
  const schedules = await generate(body);
  assert.ok(schedules.length > 0);
});

/** A resposta que o tratador de erros daria, sem passar pelo Express. */
function answerOf(err: unknown) {
  const answer = { status: 0, body: undefined as unknown };
  const res = {
    headersSent: false,
    status(code: number) {
      answer.status = code;
      return this;
    },
    json(body: unknown) {
      answer.body = body;
      return this;
    },
  };
  handleError(
    err,
    { log: { error: () => undefined } } as unknown as Request,
    res as unknown as Response,
    () => undefined,
  );
  return answer;
}

test('a rule of the domain is a 422, and an unexpected 4xx of a library keeps its status', () => {
  assert.deepEqual(answerOf(new DomainError('too_soon', 'Espere')), {
    status: 422,
    body: { error: 'too_soon', message: 'Espere' },
  });
  const odd = Object.assign(new Error('Method Not Allowed'), {
    status: 405,
    expose: true,
  });
  assert.deepEqual(answerOf(odd), {
    status: 405,
    body: { error: 'bad_request', message: 'The request could not be read' },
  });
  // um status de servidor de uma biblioteca é um 500 como outro qualquer
  assert.equal(
    answerOf(Object.assign(new Error('x'), { status: 502 })).status,
    500,
  );
});

test('an error after the answer started goes to Express, which closes the connection', () => {
  const failure = new Error('late');
  let passed: unknown;
  handleError(
    failure,
    {} as Request,
    { headersSent: true } as Response,
    err => {
      passed = err;
    },
  );
  assert.equal(passed, failure);
});
