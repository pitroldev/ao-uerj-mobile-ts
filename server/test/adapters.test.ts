import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { after, before, test } from 'node:test';

import mongoose from 'mongoose';
import { pino } from 'pino';

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
import { createWorkerPool } from '../src/adapters/outbound/scheduleSolver/workerPool.ts';
import type { GenerationRequest } from '../src/modules/schedules/domain/model.ts';

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

test('when one document of a report fails, the ones written with it are removed', async () => {
  const folder = await fs.mkdtemp(path.join(directory, 'partial-'));
  const store = createFileAttachmentStore(folder);
  // um documento que não é texto falha na gravação; o outro chega a gravar
  await assert.rejects(
    store.save('Notas', ['<html>ok</html>', 42 as unknown as string]),
    { code: 'ERR_INVALID_ARG_TYPE' },
  );
  assert.deepEqual(await fs.readdir(folder), []);
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

test('a database that does not answer is tried again, with growing pauses, until the server stops', async () => {
  const failures: number[] = [];
  const logger = pino(
    { level: 'error' },
    new Writable({
      write(chunk, encoding, done) {
        if (String(chunk).includes('MongoDB connection failed'))
          failures.push(Date.now());
        done();
      },
    }),
  );
  const database = createDatabase({
    uri: 'mongodb://127.0.0.1:1/aouerj',
    timeoutMs: 30,
    backoff: { firstMs: 20, maxMs: 80 },
    logger,
  });
  const connecting = database.connect();
  // a primeira falha não desiste: o servidor segue, sem banco, e tenta de novo
  await new Promise(resolve => setTimeout(resolve, 600));
  assert.equal(database.isReady(), false);
  assert.ok(failures.length >= 3, `${failures.length} tentativas`);

  await database.disconnect();
  assert.equal(await connecting, false);
  const attemptsWhenStopped = failures.length;
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(failures.length, attemptsWhenStopped);
});

test('stopping during an attempt does not wait for the next pause', async () => {
  const database = createDatabase({
    uri: 'mongodb://127.0.0.1:1/aouerj',
    timeoutMs: 200,
    // uma pausa longa: se o connect esperasse por ela, o teste estouraria
    backoff: { firstMs: 60_000, maxMs: 60_000 },
    logger: pino({ level: 'silent' }),
  });
  const started = performance.now();
  const connecting = database.connect();
  await database.disconnect();
  assert.equal(await connecting, false);
  assert.ok(performance.now() - started < 5000);
});

test('a request that arrives already given up is refused at the door, as an AbortError', async () => {
  const gaveUp = new AbortController();
  // um motivo que não é Error vira um AbortError, como o fetch daria
  gaveUp.abort('o app fechou');
  const isAbort = (err: unknown) =>
    err instanceof Error && err.name === 'AbortError';

  const admission = createAdmission({
    concurrency: 1,
    queueLimit: 1,
    whenFull: () => new Error('full'),
  });
  await assert.rejects(admission.enter(gaveUp.signal), isAbort);

  const pool = createWorkerPool({ url: ECHO_WORKER, memoryMb: 16 });
  await assert.rejects(pool.run('a', gaveUp.signal), isAbort);
  // nem chegou a abrir uma thread
  assert.equal(pool.size(), 0);

  await assert.rejects(
    createInlineSolver().solve(smallRequest(), { signal: gaveUp.signal }),
    isAbort,
  );
});

const SILENT_WORKER = new URL('./fixtures/silentWorker.ts', import.meta.url);
const ECHO_WORKER = new URL('./fixtures/echoWorker.ts', import.meta.url);

test('the pool keeps a warm thread, and replaces the one of a task that was given up', async () => {
  const pool = createWorkerPool({ url: ECHO_WORKER, memoryMb: 64 });
  const open = () => new AbortController().signal;
  type Echo = { threadId: number; data: string };

  const first = await pool.run<Echo>('a', open());
  const second = await pool.run<Echo>('b', open());
  // a mesma thread atende as duas
  assert.equal(second.threadId, first.threadId);
  assert.equal(second.data, 'b');
  assert.equal(pool.size(), 1);

  // um erro da tarefa não derruba a thread
  await assert.rejects(pool.run('fail', open()), /the task failed/);
  assert.equal((await pool.run<Echo>('c', open())).threadId, first.threadId);

  // quem desiste encerra a thread; a próxima tarefa ganha outra
  const gone = new AbortController();
  const hanging = pool.run('hang', gone.signal);
  setTimeout(() => gone.abort(), 20);
  await assert.rejects(hanging, { name: 'AbortError' });
  const fresh = await pool.run<Echo>('d', open());
  assert.notEqual(fresh.threadId, first.threadId);

  await pool.close();
  assert.equal(pool.size(), 0);
});

/**
 * As threads do pool não seguram o processo (no servidor, o HTTP segura):
 * sem um timer, o teste acabaria antes de a thread responder.
 */
function keepAlive(t: { after(fn: () => void): void }) {
  const timer = setInterval(() => undefined, 1000);
  t.after(() => clearInterval(timer));
}

test('a thread that runs out of heap or exits fails only its task, and the next gets a new one', async t => {
  keepAlive(t);
  const pool = createWorkerPool({ url: ECHO_WORKER, memoryMb: 16 });
  const open = () => new AbortController().signal;
  type Echo = { threadId: number; data: string };

  const first = (await pool.run<Echo>('a', open())).threadId;
  await assert.rejects(pool.run('hog', open()), {
    code: 'ERR_WORKER_OUT_OF_MEMORY',
  });
  const afterHog = (await pool.run<Echo>('b', open())).threadId;
  assert.notEqual(afterHog, first);

  await assert.rejects(
    pool.run('exit', open()),
    /The worker thread exited with code 3/,
  );
  assert.notEqual((await pool.run<Echo>('c', open())).threadId, afterHog);
  // as que morreram saíram da conta
  assert.equal(pool.size(), 1);
  await pool.close();
});

const SCHEDULE_WORKER = new URL(
  '../src/adapters/outbound/scheduleSolver/scheduleWorker.ts',
  import.meta.url,
);

test('the schedule thread answers a broken job with its error and stays for the next', async t => {
  keepAlive(t);
  const pool = createWorkerPool({ url: SCHEDULE_WORKER, memoryMb: 64 });
  const open = () => new AbortController().signal;

  await assert.rejects(
    pool.run({ request: null, budgetMs: 1000 }, open()),
    (err: Error) => err instanceof Error && err.message.length > 0,
  );
  assert.equal(pool.size(), 1);
  const result = await pool.run<{ schedules: unknown[]; exhaustive: boolean }>(
    { request: smallRequest(), budgetMs: 1000 },
    open(),
  );
  assert.equal(result.exhaustive, true);
  assert.ok(result.schedules.length > 0);
  assert.equal(pool.size(), 1);
  await pool.close();
});

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

test('whoever waits in the queue longer than allowed is refused and leaves it', async () => {
  const admission = createAdmission({
    concurrency: 1,
    queueLimit: 2,
    maxWaitMs: 30,
    whenFull: () => new Error('busy'),
  });
  const open = new AbortController().signal;
  const release = await admission.enter(open);
  const late = admission.enter(open);
  assert.deepEqual(admission.load(), { running: 1, queued: 1 });
  await assert.rejects(late, /busy/);
  assert.deepEqual(admission.load(), { running: 1, queued: 0 });
  // quem entra a tempo não é recusado depois
  const onTime = admission.enter(open);
  release();
  const second = await onTime;
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.deepEqual(admission.load(), { running: 1, queued: 0 });
  second();
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
