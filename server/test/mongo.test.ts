import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

import { createDatabase } from '../src/adapters/outbound/mongo/connection.ts';
import { defineModels } from '../src/adapters/outbound/mongo/models.ts';
import { createMongoRepositories } from '../src/adapters/outbound/mongo/repositories.ts';
import { createServer } from '../src/composition.ts';
import { UNKNOWN_PAGE } from '../src/modules/reports/domain.ts';
import { createPortalWatch } from '../src/modules/portal/application.ts';
import { UnavailableError } from '../src/shared/errors.ts';
import { startMongo, type Mongo } from './mongo.ts';
import { silentLogger, testConfig } from './support.ts';

// Os adaptadores do MongoDB contra um mongod de verdade, na versão da produção.

let mongo: Mongo;
let sequence = 0;
/** Um banco novo por teste, no mesmo mongod. */
const freshUri = () => mongo.getUri(`ao-uerj-test-${++sequence}`);

/** Conecta, registra os modelos e espera os índices. */
async function open(uri = freshUri(), autoIndex = true) {
  const db = createDatabase({
    uri,
    timeoutMs: 5000,
    autoIndex,
    logger: silentLogger,
  });
  assert.equal(await db.connect(), true);
  const models = defineModels(db.connection);
  await Promise.all(Object.values(models).map(model => model.init()));
  return { db, models, repositories: createMongoRepositories(models) };
}

const opened: Array<{ disconnect(): Promise<void> }> = [];

/** Uns milissegundos, para dois documentos não terem o mesmo `createdAt`. */
const tick = () => new Promise(resolve => setTimeout(resolve, 5));

before(async () => {
  mongo = await startMongo();
});

after(async () => {
  await Promise.all(opened.map(db => db.disconnect()));
  await mongo.stop();
});

/** As chaves de cada índice da coleção, fora o `_id`. */
async function indexesOf(
  model: ReturnType<typeof defineModels>[keyof ReturnType<typeof defineModels>],
) {
  const indexes = await model.collection.indexes();
  return indexes.map(index => index.key).filter(key => !('_id' in key));
}

test('the connection opens on the old collections, with the indexes the queries use, and closes', async () => {
  const db = createDatabase({
    uri: freshUri(),
    timeoutMs: 5000,
    logger: silentLogger,
  });
  assert.equal(db.status(), 'disconnected');
  assert.equal(db.isReady(), false);
  assert.equal(await db.connect(), true);
  assert.equal(db.status(), 'connected');
  // conectado, chamar de novo não abre outra conexão
  assert.equal(await db.connect(), true);

  const models = defineModels(db.connection);
  await Promise.all(Object.values(models).map(model => model.init()));
  // os nomes das coleções de produção
  assert.deepEqual(
    Object.values(models)
      .map(model => model.collection.collectionName)
      .sort(),
    ['docentes', 'errorreports', 'muralmessages', 'suggestions'],
  );
  assert.deepEqual(await indexesOf(models.teachers), [{ docente: 1 }]);
  assert.deepEqual(await indexesOf(models.errorReports), [{ createdAt: -1 }]);
  assert.deepEqual(await indexesOf(models.suggestions), [{ createdAt: -1 }]);
  assert.deepEqual(await indexesOf(models.muralMessages), [
    { disciplina: 1, periodo: 1, turma: 1, createdAt: -1 },
  ]);

  await db.disconnect();
  assert.equal(db.status(), 'disconnected');
  // depois do disconnect, ninguém reconecta
  assert.equal(await db.connect(), false);
});

test('without autoIndex, a connection to production creates no collection and no index', async () => {
  const { db, models, repositories } = await open(freshUri(), false);
  opened.push(db);
  assert.deepEqual(await db.connection.db!.listCollections().toArray(), []);

  // gravar continua funcionando (o Mongo cria a coleção), sem índice nenhum
  await repositories.suggestions.create({ name: 'Ana', content: 'Oi' });
  assert.deepEqual(await indexesOf(models.suggestions), []);
});

test('the mural keeps each thread apart and pages the newest messages oldest first', async () => {
  const { db, models, repositories } = await open();
  opened.push(db);
  const thread = {
    subjectId: 'IME01-10001',
    period: '2026.2',
    classNumber: '1',
  };
  // uma mensagem antiga, gravada antes das datas
  await models.muralMessages.collection.insertOne({
    fullName: 'Antigo',
    disciplina: thread.subjectId,
    periodo: thread.period,
    turma: thread.classNumber,
    message: 'sem data',
  });
  const post = (text: string, where = thread) =>
    repositories.messages.create({
      thread: where,
      authorName: '  Ana Souza  ',
      text,
    });

  for (const text of ['um', 'dois', 'três', 'quatro']) await post(text);
  await post('outra turma', { ...thread, classNumber: '2' });
  await post('outro período', { ...thread, period: '2026.1' });

  const page = await repositories.messages.listThread(thread, 3);
  assert.deepEqual(
    page.map(message => message.text),
    ['dois', 'três', 'quatro'],
  );
  const [first] = page;
  assert.equal(first.authorName, 'Ana Souza');
  assert.deepEqual(first.thread, thread);
  assert.match(first.id, /^[0-9a-f]{24}$/);
  assert.ok(first.createdAt instanceof Date && first.createdAt.getTime() > 0);

  // a sem data é a mais antiga, com a data de 1970
  const all = await repositories.messages.listThread(thread, 10);
  assert.equal(all.length, 5);
  assert.equal(all[0].text, 'sem data');
  assert.equal(all[0].createdAt.getTime(), 0);

  assert.deepEqual(
    await repositories.messages.listThread({ ...thread, classNumber: '3' }, 10),
    [],
  );
});

test('the teacher names come sorted and without the nameless documents', async () => {
  const { db, models, repositories } = await open();
  opened.push(db);
  // como os documentos antigos estão no banco: sem passar pelo esquema
  await models.teachers.collection.insertMany([
    { docente: 'BRUNO LIMA', disciplinas: { 'IME01-10001': { turmas: [1] } } },
    { docente: 'ANA (SUBSTITUTA)', disciplinas: {} },
    { disciplinas: { 'IME01-10002': {} } },
    { docente: null },
    { docente: 'ANA MARIA' },
  ]);

  assert.deepEqual(await repositories.teachers.listNames(), [
    'ANA (SUBSTITUTA)',
    'ANA MARIA',
    'BRUNO LIMA',
  ]);

  const bruno = await repositories.teachers.searchByName('bruno', 10);
  assert.equal(bruno.length, 1);
  assert.equal(bruno[0].name, 'BRUNO LIMA');
  assert.deepEqual(bruno[0].subjects, { 'IME01-10001': { turmas: [1] } });

  // o texto é literal: parêntese casa, sintaxe de expressão regular não
  assert.deepEqual(
    (await repositories.teachers.searchByName('(subst', 10)).map(t => t.name),
    ['ANA (SUBSTITUTA)'],
  );
  assert.deepEqual(await repositories.teachers.searchByName('.*', 10), []);
  assert.equal((await repositories.teachers.searchByName('ana', 1)).length, 1);
});

test('an error report and a suggestion keep the old fields and are listed newest first', async () => {
  const { db, models, repositories } = await open();
  opened.push(db);

  const report = await repositories.reports.create({
    page: ' Login ',
    description: 'Não entra',
    email: ' Ana@UERJ.br ',
    attachmentIds: ['arquivo-1', 'arquivo-2'],
  });
  assert.equal(report.page, 'Login');
  assert.equal(report.email, 'ana@uerj.br');
  assert.deepEqual(report.attachmentIds, ['arquivo-1', 'arquivo-2']);
  // no banco, o nome antigo do campo
  const stored = await models.errorReports.collection.findOne({});
  assert.deepEqual(stored?.filesID, ['arquivo-1', 'arquivo-2']);

  // relatos chegam com segundos de diferença; no mesmo milissegundo, empatam
  await tick();
  await repositories.reports.create({ page: 'Notas', attachmentIds: [] });
  assert.deepEqual(
    (await repositories.reports.listRecent(10)).map(item => item.page),
    ['Notas', 'Login'],
  );
  assert.equal((await repositories.reports.listRecent(1)).length, 1);

  await repositories.suggestions.create({
    name: 'Ana',
    content: 'Modo escuro',
    email: 'ANA@UERJ.BR',
  });
  await tick();
  await repositories.suggestions.create({ name: 'Bia', content: 'Widget' });
  const suggestions = await repositories.suggestions.listRecent(10);
  assert.deepEqual(
    suggestions.map(item => item.name),
    ['Bia', 'Ana'],
  );
  assert.equal(suggestions[1].email, 'ana@uerj.br');
  assert.equal(suggestions[0].email, undefined);
});

test('the review counts by screen, filters by status and resolves by id, old reports included', async () => {
  const { db, models, repositories } = await open();
  opened.push(db);
  const { reports } = repositories;
  const login = await reports.create({ page: 'Login', attachmentIds: [] });
  await tick();
  const notes = await reports.create({ page: 'Notas', attachmentIds: [] });
  await tick();
  await reports.create({ page: 'Notas', attachmentIds: [] });
  // um relato de antes da triagem: sem o campo resolvedAt
  await models.errorReports.collection.insertOne({
    page: 'RID',
    filesID: [],
    createdAt: new Date(Date.UTC(2024, 5, 1)),
  });
  assert.equal(login.resolvedAt, null);

  assert.deepEqual(await reports.summarize(), {
    open: 4,
    resolved: 0,
    pages: [
      { page: 'Notas', open: 2, resolved: 0 },
      { page: 'Login', open: 1, resolved: 0 },
      { page: 'RID', open: 1, resolved: 0 },
    ],
  });

  const at = new Date(Date.UTC(2026, 10, 1, 12));
  const resolved = await reports.setResolvedAt(notes.id, at);
  assert.deepEqual(resolved?.resolvedAt, at);
  const summary = await reports.summarize();
  assert.deepEqual([summary.open, summary.resolved], [3, 1]);
  assert.deepEqual(summary.pages[0], { page: 'Notas', open: 1, resolved: 1 });

  const pages = (found: { reports: { page: string }[] }) =>
    found.reports.map(report => report.page);
  const pending = await reports.listForReview({ status: 'open' }, 10);
  assert.deepEqual(pages(pending), ['Notas', 'Login', 'RID']);
  assert.equal(pending.total, 3);
  const limited = await reports.listForReview({ status: 'open' }, 1);
  assert.deepEqual([limited.reports.length, limited.total], [1, 3]);
  assert.deepEqual(
    pages(await reports.listForReview({ status: 'resolved' }, 10)),
    ['Notas'],
  );
  assert.deepEqual(
    pages(await reports.listForReview({ status: 'all', page: 'Notas' }, 10)),
    ['Notas', 'Notas'],
  );

  assert.equal((await reports.findById(login.id))?.page, 'Login');
  // um id que não é do Mongo não vira consulta, nem erro
  assert.equal(await reports.findById('nao-e-um-id'), null);
  assert.equal(await reports.findById('0123456789abcdef01234567'), null);
  assert.equal(await reports.setResolvedAt('nao-e-um-id', at), null);
  assert.equal((await reports.setResolvedAt(notes.id, null))?.resolvedAt, null);
});

test('old reports without a screen join one "Sem tela" line that filters like any other', async () => {
  const { db, models, repositories } = await open();
  opened.push(db);
  const { reports } = repositories;
  // como os 6 da produção: sem tela nem descrição; e um nulo, por garantia
  await models.errorReports.collection.insertMany([
    { filesID: [], createdAt: new Date(Date.UTC(2023, 0, 1)) },
    { page: null, filesID: [], createdAt: new Date(Date.UTC(2023, 0, 2)) },
  ]);
  // o empate de contagem que derrubou a página: a ordem compara os nomes
  await reports.create({ page: 'Notas', attachmentIds: [] });
  await reports.create({ page: 'Notas', attachmentIds: [] });

  const summary = await reports.summarize();
  assert.deepEqual(
    summary.pages.map(({ page, open: count }) => [page, count]),
    [
      ['Notas', 2],
      [UNKNOWN_PAGE, 2],
    ],
  );
  const unknown = await reports.listForReview(
    { status: 'open', page: UNKNOWN_PAGE },
    10,
  );
  assert.equal(unknown.total, 2);
  assert.ok(unknown.reports.every(report => report.page === UNKNOWN_PAGE));
  assert.ok(unknown.reports.every(report => report.description === undefined));
});

test('a database that goes away mid-flight is a 503, and a refused document is not', async () => {
  // um mongod só deste teste, para derrubar sem atrapalhar os outros
  const own = await startMongo();
  const db = createDatabase({
    uri: own.getUri('queda'),
    timeoutMs: 500,
    logger: silentLogger,
  });
  assert.equal(await db.connect(), true);
  const repositories = createMongoRepositories(defineModels(db.connection));
  const thread = {
    subjectId: 'IME01-10001',
    period: '2026.2',
    classNumber: '1',
  };

  // um documento que o esquema recusa segue como erro do servidor
  await assert.rejects(
    repositories.messages.create({ thread, authorName: '', text: 'oi' }),
    (err: Error) => err.name === 'ValidationError',
  );

  await own.stop();
  await assert.rejects(
    repositories.messages.listThread(thread, 10),
    (err: unknown) =>
      err instanceof UnavailableError && err.code === 'database_unavailable',
  );
  // com o banco fora, a conexão já se diz fechada, mas o cliente segue vivo:
  // se o disconnect não o fechar, este arquivo de testes nunca termina
  assert.equal(db.status(), 'disconnected');
  await db.disconnect();
});

test('the whole server runs on MongoDB: writes, reads, attachments and the status', async () => {
  const reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ao-uerj-mongo-'));
  const portal = createPortalWatch({ probe: async () => 200 });
  const server = createServer(
    testConfig({
      MONGODB_URI: freshUri(),
      REPORTS_DIR: reportsDir,
      RELEASE_COMMIT: 'abc1234',
    }),
    silentLogger,
    { portal },
  );
  const { port } = await server.start(0);
  const base = `http://127.0.0.1:${port}/aouerj`;
  const post = (route: string, body: unknown) =>
    fetch(`${base}${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  try {
    // a partida não espera o banco: as rotas dele respondem quando conectar
    for (let tries = 0; ; tries++) {
      const health = (await (await fetch(`${base}/health`)).json()) as {
        database: string;
      };
      if (health.database === 'connected') break;
      assert.ok(tries < 100, 'o banco não conectou');
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const thread = { disciplina: 'IME01-10001', periodo: '2026.2', turma: 1 };
    assert.equal(
      (
        await post('/messages/post', {
          ...thread,
          fullName: 'Ana',
          message: 'Oi',
        })
      ).status,
      200,
    );
    const messages = (await (await post('/messages/get', thread)).json()) as {
      message: string;
      turma: string;
    }[];
    assert.equal(messages.length, 1);
    assert.equal(messages[0].message, 'Oi');
    assert.equal(messages[0].turma, '1');

    const reported = await post('/reportError', {
      page: 'Notas',
      html: ['<html>página</html>'],
    });
    assert.deepEqual(await reported.json(), { status: 'ok' });
    const files = await fs.readdir(reportsDir);
    assert.equal(files.length, 1);
    assert.match(files[0], /^Notas-[0-9a-f-]{36}\.html$/);

    const teachers = await (await fetch(`${base}/docentes`)).json();
    assert.deepEqual(teachers, { docentes: [] });

    const status = await fetch(`${base}/status`);
    assert.equal(status.status, 200);
    const body = (await status.json()) as {
      database: string;
      release: { commit: string };
    };
    assert.equal(body.database, 'connected');
    assert.equal(body.release.commit, 'abc1234');
  } finally {
    await server.stop();
    await fs.rm(reportsDir, { recursive: true, force: true });
  }
});
