import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

import mongoose from 'mongoose';

import {
  createFileAttachmentStore,
  slugify,
} from '../src/adapters/outbound/files/attachmentStore.ts';
import { createDatabase } from '../src/adapters/outbound/mongo/connection.ts';
import { toReport } from '../src/adapters/outbound/mongo/errorReportRepository.ts';
import { toMessage } from '../src/adapters/outbound/mongo/messageRepository.ts';
import { defineModels } from '../src/adapters/outbound/mongo/models.ts';
import {
  escapeRegularExpression,
  toTeacher,
} from '../src/adapters/outbound/mongo/teacherRepository.ts';
import { createAdmission } from '../src/adapters/outbound/scheduleSolver/admission.ts';
import { createInlineSolver } from '../src/adapters/outbound/scheduleSolver/inlineSolver.ts';
import { createThreadedSolver } from '../src/adapters/outbound/scheduleSolver/threadedSolver.ts';
import type { GenerationRequest } from '../src/modules/schedules/domain/model.ts';
import { silentLogger } from './support.ts';

let directory: string;

before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ao-uerj-reports-'));
});

after(async () => {
  await fs.rm(directory, { recursive: true, force: true });
});

test('an attachment name cannot leave the folder', () => {
  assert.equal(slugify('../../escape/attempt'), 'escape-attempt');
  assert.equal(slugify('Notas do Período'), 'Notas-do-Periodo');
  assert.equal(slugify('///'), 'report');
  assert.equal(slugify('x'.repeat(100)).length, 80);
});

test('the attachments are written as files and discarded on demand', async () => {
  const store = createFileAttachmentStore(directory);
  const ids = await store.save('../../escape', ['<main>a</main>', '{}']);

  assert.equal(ids.length, 2);
  const files = await fs.readdir(directory);
  assert.deepEqual(files.sort(), ids.map(id => `escape-${id}.html`).sort());
  assert.equal(
    await fs.readFile(path.join(directory, `escape-${ids[0]}.html`), 'utf8'),
    '<main>a</main>',
  );

  await store.discard('../../escape', ids);
  assert.deepEqual(await fs.readdir(directory), []);
  assert.deepEqual(await store.save('vazio', []), []);
});

test('a write that fails leaves nothing behind', async () => {
  const blocked = path.join(directory, 'not-a-folder');
  await fs.writeFile(blocked, '');
  const store = createFileAttachmentStore(blocked);
  await assert.rejects(store.save('p', ['a']));
  await fs.rm(blocked);
});

test('the models keep the old names, fields and limits', async () => {
  const models = defineModels(mongoose.createConnection());
  assert.equal(models.muralMessages.collection.collectionName, 'muralmessages');
  assert.equal(models.teachers.collection.collectionName, 'docentes');
  assert.equal(models.errorReports.collection.collectionName, 'errorreports');
  assert.equal(models.suggestions.collection.collectionName, 'suggestions');

  await assert.rejects(
    new models.muralMessages({}).validate(),
    (err: { errors: Record<string, unknown> }) =>
      ['fullName', 'disciplina', 'periodo', 'turma', 'message'].every(
        field => field in err.errors,
      ),
  );
  await assert.rejects(
    new models.muralMessages({
      fullName: 'Ada',
      disciplina: 'IME',
      periodo: '2026.2',
      turma: '1',
      message: 'x'.repeat(10001),
    }).validate(),
  );
  // a turma em número vira texto, como sempre foi
  const message = new models.muralMessages({
    fullName: 'Ada',
    disciplina: 'IME',
    periodo: '2026.2',
    turma: 1,
    message: 'Oi',
  });
  await message.validate();
  assert.equal(message.turma, '1');
});

test('the documents become domain objects, old numeric classes included', () => {
  const at = new Date(Date.UTC(2026, 9, 22));
  assert.deepEqual(
    toMessage({
      _id: 'm1',
      fullName: 'Ada',
      disciplina: 'IME02-10892',
      periodo: '2026.2',
      turma: 1,
      message: 'Oi',
      createdAt: at,
      updatedAt: at,
    }),
    {
      id: 'm1',
      thread: { subjectId: 'IME02-10892', period: '2026.2', classNumber: '1' },
      authorName: 'Ada',
      text: 'Oi',
      createdAt: at,
      updatedAt: at,
    },
  );
  assert.deepEqual(toTeacher({ _id: 't1', docente: 'Ada' }), {
    id: 't1',
    name: 'Ada',
    subjects: undefined,
    createdAt: undefined,
    updatedAt: undefined,
  });
  assert.deepEqual(
    toReport({ _id: 'r1', page: 'p', createdAt: at, updatedAt: at })
      .attachmentIds,
    [],
  );
  assert.equal(escapeRegularExpression('a.*(b)'), 'a\\.\\*\\(b\\)');
});

test('a database that does not answer fails fast without stopping the server', async () => {
  const database = createDatabase({
    uri: 'mongodb://127.0.0.1:1/aouerj',
    timeoutMs: 50,
    logger: silentLogger,
  });
  const startedAt = Date.now();
  assert.equal(await database.connect(), false);
  assert.equal(database.isReady(), false);
  assert.equal(database.status(), 'disconnected');
  assert.ok(Date.now() - startedAt < 1000);
  await database.disconnect();
});

const SILENT_WORKER = new URL('./fixtures/silentWorker.ts', import.meta.url);

/** Um pedido pequeno, já no formato do domínio. */
const smallRequest = (): GenerationRequest => ({
  subjects: ['A', 'B'].map(id => ({
    id,
    credits: 4,
    workload: 60,
    mandatory: true,
    allowsConflict: false,
    criticality: 0,
    blocks: 0,
  })),
  classes: [
    { subjectId: 'A', intervals: [{ day: 0, start: 420, end: 520 }] },
    { subjectId: 'B', intervals: [{ day: 0, start: 420, end: 520 }] },
    { subjectId: 'B', intervals: [{ day: 1, start: 420, end: 520 }] },
  ],
  minSubjects: 1,
  maxSubjects: 2,
  busy: [],
  priorities: ['MIN_GAPS'],
});

test('the admission lets some in, queues some in order, refuses the rest and counts a release once', async () => {
  const admission = createAdmission({
    concurrency: 1,
    queueLimit: 2,
    whenFull: () => new Error('full'),
  });
  const open = new AbortController().signal;
  const order: string[] = [];
  const first = await admission.enter(open);
  const second = admission.enter(open).then(release => {
    order.push('second');
    return release;
  });
  const third = admission.enter(open).then(release => {
    order.push('third');
    return release;
  });
  await assert.rejects(admission.enter(open), /full/);
  assert.deepEqual(admission.load(), { running: 1, queued: 2 });

  first();
  first();
  const releaseSecond = await second;
  assert.deepEqual(admission.load(), { running: 1, queued: 1 });
  releaseSecond();
  (await third)();
  assert.deepEqual(order, ['second', 'third']);
  assert.deepEqual(admission.load(), { running: 0, queued: 0 });
});

test('a worker thread finds the same schedules as the search in this thread', async () => {
  const solver = createThreadedSolver({
    concurrency: 1,
    queueLimit: 0,
    budgetMs: 1000,
  });
  const expected = await createInlineSolver().solve(smallRequest());
  assert.deepEqual(await solver.solve(smallRequest()), expected);
  assert.deepEqual(solver.load(), { running: 0, queued: 0 });
  await solver.close?.();
});

test('the generator queue refuses the overflow, drops whoever gives up and closes cleanly', async () => {
  const solver = createThreadedSolver({
    concurrency: 1,
    queueLimit: 1,
    budgetMs: 60000,
    workerUrl: SILENT_WORKER,
  });
  const running = solver.solve(smallRequest());
  const gone = new AbortController();
  const queued = solver.solve(smallRequest(), { signal: gone.signal });
  assert.deepEqual(solver.load(), { running: 1, queued: 1 });

  await assert.rejects(solver.solve(smallRequest()), {
    code: 'generator_busy',
  });

  gone.abort();
  await assert.rejects(queued, { name: 'AbortError' });
  assert.deepEqual(solver.load(), { running: 1, queued: 0 });

  const waiting = solver.solve(smallRequest());
  const closing = Promise.all([
    assert.rejects(running, { code: 'generator_unavailable' }),
    assert.rejects(waiting, { code: 'generator_unavailable' }),
  ]);
  await solver.close?.();
  await closing;
  assert.deepEqual(solver.load(), { running: 0, queued: 0 });
  await assert.rejects(solver.solve(smallRequest()), {
    code: 'generator_unavailable',
  });
});

test('a thread that does not answer in time is ended, and so is one nobody waits for', async () => {
  const solver = createThreadedSolver({
    concurrency: 2,
    queueLimit: 0,
    budgetMs: 10,
    graceMs: 50,
    workerUrl: SILENT_WORKER,
  });
  await assert.rejects(solver.solve(smallRequest()), {
    code: 'generator_timeout',
  });

  const patient = createThreadedSolver({
    concurrency: 1,
    queueLimit: 0,
    budgetMs: 60000,
    workerUrl: SILENT_WORKER,
  });
  const gone = new AbortController();
  const abandoned = patient.solve(smallRequest(), { signal: gone.signal });
  setTimeout(() => gone.abort(), 20);
  await assert.rejects(abandoned, { name: 'AbortError' });
  assert.deepEqual(patient.load(), { running: 0, queued: 0 });
});
