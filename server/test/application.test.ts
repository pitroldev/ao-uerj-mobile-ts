import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createMural } from '../src/modules/mural/application.ts';
import { THREAD_PAGE } from '../src/modules/mural/domain.ts';
import { createErrorReports } from '../src/modules/reports/application.ts';
import { parseDiagnostic } from '../src/modules/reports/domain.ts';
import { createSuggestions } from '../src/modules/suggestions/application.ts';
import { createTeacherDirectory } from '../src/modules/teachers/application.ts';
import { cacheFor } from '../src/shared/clock.ts';
import {
  manualClock,
  memoryAttachments,
  memoryRepositories,
} from './support.ts';

const thread = { subjectId: 'IME02-10892', period: '2026.2', classNumber: '1' };

test('the mural keeps each thread apart and returns the newest page oldest first', async () => {
  const { repositories } = memoryRepositories();
  const mural = createMural(repositories.messages);
  for (let index = 0; index < THREAD_PAGE + 2; index += 1) {
    await mural.post({ thread, authorName: 'Ada', text: `m${index}` });
  }
  await mural.post({
    thread: { ...thread, classNumber: '2' },
    authorName: 'Bea',
    text: 'outra turma',
  });

  const page = await mural.listThread(thread);
  assert.equal(page.length, THREAD_PAGE);
  // as mais recentes, na ordem em que o app as mostra
  assert.equal(page[0].text, 'm2');
  assert.equal(page.at(-1)?.text, `m${THREAD_PAGE + 1}`);
  assert.ok(page.every(message => message.thread.classNumber === '1'));
});

test('the teacher names are sorted in Portuguese and cached for a while', async () => {
  const clock = manualClock();
  const { repositories, data } = memoryRepositories(clock);
  data.teachers.push(
    { id: '1', name: 'Zélia', subjects: {} },
    { id: '2', name: 'Álvaro', subjects: {} },
    { id: '3', name: 'Ana', subjects: {} },
  );
  let reads = 0;
  const counted = {
    ...repositories.teachers,
    listNames: () => {
      reads += 1;
      return repositories.teachers.listNames();
    },
  };
  const directory = createTeacherDirectory(counted, {
    cacheMs: 60_000,
    now: clock.now,
  });

  assert.deepEqual(await directory.names(), ['Álvaro', 'Ana', 'Zélia']);
  await directory.names();
  assert.equal(reads, 1);
  clock.advance(60_001);
  await directory.names();
  assert.equal(reads, 2);
  assert.deepEqual(
    (await directory.search('an')).map(teacher => teacher.name),
    ['Ana'],
  );
});

test('a failed load is not cached', async () => {
  let calls = 0;
  const cached = cacheFor(
    async () => {
      calls += 1;
      if (calls === 1) throw new Error('banco fora');
      return 'ok';
    },
    { ttlMs: 60_000 },
  );
  await assert.rejects(cached.get(), /banco fora/);
  assert.equal(await cached.get(), 'ok');
  assert.equal(calls, 2);
});

test('an error report keeps its attachments, and loses them when the report fails', async () => {
  const { repositories, data } = memoryRepositories();
  const attachments = memoryAttachments();
  const reports = createErrorReports(repositories.reports, attachments.store);

  const report = await reports.submit({
    page: 'Notas',
    description: 'Some a P2',
    attachments: ['{"parser":"3"}'],
  });
  assert.deepEqual(report.attachmentIds, ['file-1']);
  assert.equal(attachments.files.get('Notas/file-1'), '{"parser":"3"}');
  assert.equal(data.reports.length, 1);

  const failing = createErrorReports(
    {
      ...repositories.reports,
      create: async () => {
        throw new Error('banco fora');
      },
    },
    attachments.store,
  );
  await assert.rejects(
    failing.submit({ page: 'Notas', attachments: ['a', 'b'] }),
    /banco fora/,
  );
  assert.deepEqual([...attachments.files.keys()], ['Notas/file-1']);
});

test('only a JSON of schema 1 with the expected fields is a diagnostic', () => {
  const valid = {
    schemaVersion: 1,
    operation: 'Notas',
    category: 'USER_REPORT',
    appVersion: '2.10.0',
    parserVersion: '2026.10.2',
  };
  assert.deepEqual(parseDiagnostic(JSON.stringify(valid)), {
    operation: 'Notas',
    category: 'USER_REPORT',
    appVersion: '2.10.0',
    parserVersion: '2026.10.2',
  });
  assert.deepEqual(
    parseDiagnostic(
      JSON.stringify({
        ...valid,
        subjectCode: 'IME02-10871',
        eventId: 'abc',
        extra: 1,
      }),
    ),
    {
      operation: 'Notas',
      category: 'USER_REPORT',
      appVersion: '2.10.0',
      parserVersion: '2026.10.2',
      subjectCode: 'IME02-10871',
      eventId: 'abc',
    },
  );
  for (const content of [
    '<html><body>página do portal</body></html>',
    '{quebrado',
    'null',
    JSON.stringify({ ...valid, schemaVersion: 2 }),
    JSON.stringify({ ...valid, appVersion: 210 }),
    JSON.stringify({ ...valid, appVersion: 'x'.repeat(41) }),
  ])
    assert.equal(parseDiagnostic(content), null, content);
});

test('the review opens each attachment only enough to tell what it is, and one opens only from its own report', async () => {
  const { repositories } = memoryRepositories();
  const attachments = memoryAttachments();
  const reports = createErrorReports(repositories.reports, attachments.store, {
    now: () => Date.UTC(2026, 10, 1, 12),
  });
  const diagnostic = JSON.stringify({
    schemaVersion: 1,
    operation: 'Notas',
    category: 'USER_REPORT',
    appVersion: '2.10.0',
    parserVersion: '2026.10.2',
  });
  const modern = await reports.submit({
    page: 'Notas',
    attachments: [diagnostic],
  });
  const old = await reports.submit({
    page: 'Notas',
    attachments: [`<html>${'x'.repeat(20_000)}</html>`],
  });
  // um anexo que sumiu da pasta
  const lost = await reports.submit({
    page: 'Login',
    attachments: ['<p></p>'],
  });
  attachments.files.delete(`Login/${lost.attachmentIds[0]}`);
  const kept = await reports.submit({
    page: 'Login',
    attachments: ['<p>1.x</p>'],
  });

  const review = await reports.review({ status: 'open' });
  assert.equal(review.total, 4);
  const kinds = new Map(
    review.reports.map(report => [report.id, report.attachments[0].kind]),
  );
  assert.equal(kinds.get(modern.id), 'diagnostic');
  // a página grande da 1.x nem é lida inteira
  assert.equal(kinds.get(old.id), 'page');
  assert.equal(kinds.get(lost.id), 'missing');
  assert.equal(kinds.get(kept.id), 'page');

  const resolved = await reports.setResolved(modern.id, true);
  assert.deepEqual(resolved?.resolvedAt, new Date(Date.UTC(2026, 10, 1, 12)));
  assert.equal((await reports.summarize()).resolved, 1);

  const opened = await reports.attachment(modern.id, modern.attachmentIds[0]);
  assert.equal(opened?.kind, 'diagnostic');
  assert.equal(opened?.kind === 'diagnostic' && opened.raw, diagnostic);
  assert.equal(
    (await reports.attachment(kept.id, kept.attachmentIds[0]))?.kind,
    'page',
  );
  // o anexo de outro relato não abre por este
  assert.equal(
    await reports.attachment(modern.id, kept.attachmentIds[0]),
    null,
  );
  assert.equal(await reports.attachment('nenhum', kept.attachmentIds[0]), null);
  assert.equal(await reports.attachment(lost.id, lost.attachmentIds[0]), null);
});

test('the admin listings bring the newest first', async () => {
  const { repositories } = memoryRepositories();
  const suggestions = createSuggestions(repositories.suggestions);
  await suggestions.submit({ name: 'Ada', content: 'primeira' });
  await suggestions.submit({ name: 'Bea', content: 'segunda' });
  assert.deepEqual(
    (await suggestions.listRecent()).map(item => item.content),
    ['segunda', 'primeira'],
  );
});
