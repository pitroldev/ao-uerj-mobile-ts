import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, test } from 'node:test';

import { createDatabase } from '../src/adapters/outbound/mongo/connection.ts';
import { defineModels } from '../src/adapters/outbound/mongo/models.ts';
import { createMongoRepositories } from '../src/adapters/outbound/mongo/repositories.ts';
import { createCompanion } from '../src/modules/companion/application.ts';
import type { StoredStudent } from '../src/modules/students/domain.ts';
import { startMongo, type Mongo } from './mongo.ts';
import { silentLogger } from './support.ts';

// Os alunos, as sessões e o aluno nos membros da Companhia, contra um mongod de verdade.

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
let mongo: Mongo;
let sequence = 0;
const opened: Array<{ disconnect(): Promise<void> }> = [];

before(async () => {
  mongo = await startMongo();
});

after(async () => {
  await Promise.all(opened.map(db => db.disconnect()));
  await mongo.stop();
});

async function open() {
  const db = createDatabase({
    uri: mongo.getUri(`ao-uerj-students-${++sequence}`),
    timeoutMs: 5000,
    logger: silentLogger,
  });
  assert.equal(await db.connect(), true);
  opened.push(db);
  const models = defineModels(db.connection);
  await Promise.all(Object.values(models).map(model => model.init()));
  return { models, repositories: createMongoRepositories(models) };
}

const student = (id: string, lookup: string, now: Date): StoredStudent => ({
  id,
  lookup,
  matricula: 'v1.cifrada',
  name: 'v1.cifrado',
  createdAt: now,
  lastSeenAt: now,
  devices: [{ id: 'd1', firstSeenAt: now, lastSeenAt: now }],
  ban: null,
});

test('one student per matrícula, the devices that came back and the bans', async () => {
  const { repositories } = await open();
  const students = repositories.students;
  const now = new Date();

  const first = await students.create(student('s1', 'hmac-1', now));
  // a mesma matrícula de outro aparelho, ao mesmo tempo: fica a primeira
  const race = await students.create(student('s2', 'hmac-1', now));
  assert.equal(race.id, first.id);
  assert.equal((await students.findByLookup('hmac-1'))?.id, 's1');

  // o aparelho conhecido ganha a hora; os novos entram e a lista guarda 3
  const later = new Date(now.getTime() + MINUTE);
  await students.seen('s1', {
    name: 'v1.novo',
    device: 'd1',
    now: later,
    keepDevices: 3,
  });
  const at = (seconds: number) => new Date(later.getTime() + seconds * 1000);
  for (const [index, device] of ['d2', 'd3', 'd4'].entries())
    await students.seen('s1', {
      name: 'v1.novo',
      device,
      now: at(index + 1),
      keepDevices: 3,
    });
  const seen = await students.findById('s1');
  assert.deepEqual(
    seen?.devices.map(device => device.id),
    ['d2', 'd3', 'd4'],
  );
  assert.equal(seen?.name, 'v1.novo');
  assert.equal(seen?.lastSeenAt.getTime(), at(3).getTime());
  // o d2 voltou: quando um novo entra, sai o usado há mais tempo (o d3)
  for (const [index, device] of ['d2', 'd5'].entries())
    await students.seen('s1', {
      name: 'v1.novo',
      device,
      now: at(index + 4),
      keepDevices: 3,
    });
  assert.deepEqual(
    (await students.findById('s1'))?.devices.map(device => device.id),
    ['d4', 'd2', 'd5'],
  );

  await students.create(student('s3', 'hmac-3', now));
  await students.setBan('s3', { until: null, reason: 'Assédio', at: now });
  await students.setBan('s1', {
    until: new Date(now.getTime() - DAY),
    reason: 'Venceu',
    at: now,
  });
  assert.deepEqual(
    (await students.listBanned(now, 10)).map(item => item.id),
    ['s3'],
  );
  assert.equal((await students.setBan('s3', null))?.ban, null);
  assert.deepEqual(
    (await students.findMany(['s1', 's3', 'nobody']))
      .map(item => item.id)
      .sort(),
    ['s1', 's3'],
  );
  assert.equal((await students.listRecent(1))[0]?.id, 's1');
});

test('a session is found until it expires, gets touched and is removed', async () => {
  const { repositories } = await open();
  const sessions = repositories.studentSessions;
  const now = new Date();
  const id = randomBytes(32).toString('hex');
  await sessions.create({
    id,
    student: 's1',
    device: 'd1',
    createdAt: now,
    lastUsedAt: now,
    expiresAt: new Date(now.getTime() + DAY),
  });
  assert.equal((await sessions.find(id, now))?.student, 's1');
  assert.equal(
    await sessions.find(id, new Date(now.getTime() + 2 * DAY)),
    null,
  );
  await sessions.touch(
    id,
    new Date(now.getTime() + MINUTE),
    new Date(now.getTime() + 3 * DAY),
  );
  assert.ok(await sessions.find(id, new Date(now.getTime() + 2 * DAY)));
  await sessions.remove(id);
  assert.equal(await sessions.find(id, now), null);
});

test('the Companhia keeps the student of each member and finds the calls of a student', async () => {
  const { repositories } = await open();
  const companion = createCompanion({
    calls: repositories.companionCalls,
    reports: repositories.companionReports,
  });
  const at = new Date(Date.now() + 20 * MINUTE);
  const request = {
    kind: 'lunch' as const,
    at,
    spot: 'ru' as const,
    destination: null,
    note: '',
    capacity: 4,
    name: 'Júlia',
  };
  const created = await companion.open(request, { studentId: 'julia' });
  await companion.join(created.call.id, 'Lucas', { studentId: 'lucas' });
  const alive = await repositories.companionCalls.listAliveWith(
    'lucas',
    new Date(),
  );
  assert.deepEqual(
    alive.map(call => call.id),
    [created.call.id],
  );
  assert.deepEqual(
    alive[0]?.members.map(member => member.student),
    ['julia', 'lucas'],
  );
  // o filtro do próprio update: duas entradas juntas do mesmo aluno, uma fica
  const twice = await Promise.allSettled(
    [1, 2].map(() =>
      companion.join(created.call.id, 'Ana', { studentId: 'ana' }),
    ),
  );
  assert.deepEqual(twice.map(result => result.status).sort(), [
    'fulfilled',
    'rejected',
  ]);
  assert.equal(
    (await repositories.companionCalls.find(created.call.id, new Date()))
      ?.members.length,
    3,
  );
  await companion.dropStudent('ana');
  assert.equal(
    (await repositories.companionCalls.find(created.call.id, new Date()))
      ?.members.length,
    2,
  );
  await companion.report(created.call.id, { outsider: true }, 'spam', {
    studentId: 'ana',
  });
  const [report] = await repositories.companionReports.listRecent(1);
  assert.equal(report?.reporterStudent, 'ana');
  assert.deepEqual(report?.people, [
    { name: 'Júlia', host: true, student: 'julia' },
    { name: 'Lucas', host: false, student: 'lucas' },
  ]);
});
