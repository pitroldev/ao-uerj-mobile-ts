import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { createDatabase } from '../src/adapters/outbound/mongo/connection.ts';
import { defineModels } from '../src/adapters/outbound/mongo/models.ts';
import { createMongoRepositories } from '../src/adapters/outbound/mongo/repositories.ts';
import { createCompanion } from '../src/modules/companion/application.ts';
import { ConflictError, NotFoundError } from '../src/shared/errors.ts';
import { startMongo, type Mongo } from './mongo.ts';
import { manualClock, silentLogger } from './support.ts';

// O repositório da Companhia agora contra um mongod de verdade.

const MINUTE = 60 * 1000;
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
    uri: mongo.getUri(`ao-uerj-companion-${++sequence}`),
    timeoutMs: 5000,
    logger: silentLogger,
  });
  assert.equal(await db.connect(), true);
  opened.push(db);
  const models = defineModels(db.connection);
  await Promise.all(Object.values(models).map(model => model.init()));
  const repositories = createMongoRepositories(models);
  const clock = manualClock(Date.now());
  const companion = createCompanion({
    calls: repositories.companionCalls,
    reports: repositories.companionReports,
    stats: repositories.companionStats,
    watchers: repositories.companionWatchers,
    watchingCacheMs: 0,
    now: clock.now,
  });
  return { models, repositories, clock, companion };
}

const request = (at: Date) => ({
  kind: 'lunch' as const,
  at,
  spot: 'ru' as const,
  destination: null,
  note: 'Mesa perto da entrada',
  capacity: 4,
  name: 'Júlia',
});

test('the calls and the reports vanish by TTL, and the list has its index', async () => {
  const { models } = await open();
  const keys = async (model: typeof models.companionCalls) =>
    (await model.collection.indexes())
      .filter(index => !('_id' in index.key))
      .map(index => [index.key, index.expireAfterSeconds ?? null]);
  assert.deepEqual(await keys(models.companionCalls), [
    [{ expiresAt: 1 }, 0],
    [{ listedUntil: 1 }, null],
  ]);
  assert.deepEqual(
    (await models.companionReports.collection.indexes())
      .filter(index => !('_id' in index.key))
      .map(index => [index.key, index.expireAfterSeconds ?? null]),
    [
      [{ expiresAt: 1 }, 0],
      [{ createdAt: -1 }, null],
      [{ callId: 1 }, null],
    ],
  );
  // os números e quem olhou também somem sozinhos
  for (const model of [models.companionStats, models.companionWatchers])
    assert.deepEqual(
      (await model.collection.indexes())
        .filter(index => !('_id' in index.key))
        .map(index => [index.key, index.expireAfterSeconds ?? null]),
      [[{ expiresAt: 1 }, 0]],
    );
});

test('the last seat goes to one person only, even at the same time', async () => {
  const { companion, clock } = await open();
  const { call } = await companion.open(
    request(new Date(clock.now() + 20 * MINUTE)),
  );
  const names = ['Ana', 'Bia', 'Caio', 'Davi', 'Eva', 'Fábio'];
  const results = await Promise.allSettled(
    names.map(name => companion.join(call.id, name)),
  );
  const joined = results.filter(result => result.status === 'fulfilled');
  const refused = results.filter(result => result.status === 'rejected');
  // 4 vagas: quem chamou e mais três
  assert.equal(joined.length, 3);
  assert.equal(refused.length, 3);
  for (const result of refused)
    assert.ok(
      result.reason instanceof ConflictError &&
        result.reason.code === 'call_full',
    );
  const {
    calls: [listed],
  } = await companion.list();
  assert.equal(listed.going, 4);
  // a chamada chegou a duas pessoas uma vez só, mesmo com três entrando juntos
  const [today] = await companion.statsForReview(1);
  assert.equal(today.counts.filled_lunch, 1);
  assert.equal(today.counts.joined, 3);
  assert.equal(today.counts.full, 1);
});

test('the host removes someone for good, and the counts and the watchers live in Mongo', async () => {
  const { companion, clock, models } = await open();
  const host = await companion.open(
    request(new Date(clock.now() + 5 * MINUTE)),
  );
  const ana = await companion.join(host.call.id, 'Ana');
  const ref = ana.call.members.find(member => member.you)!.ref;
  assert.match(ref, /^[A-Za-z0-9_-]{11}$/);

  const remaining = await companion.remove(host.call.id, host.memberKey, ref);
  assert.deepEqual(
    remaining.members.map(member => member.name),
    ['Júlia'],
  );
  await assert.rejects(
    companion.read(host.call.id, ana.memberKey),
    (err: unknown) =>
      err instanceof Error && 'code' in err && err.code === 'removed_from_call',
  );
  const stored = await models.companionCalls
    .findById(host.call.id)
    .lean<{ removed: string[]; filledAt: Date | null }>();
  assert.equal(stored?.removed.length, 1);
  assert.ok(stored?.filledAt);

  // "Cheguei no ponto" conta a chamada uma vez, e só com companhia: aqui,
  // quem chamou ficou sozinho
  await companion.say(host.call.id, host.memberKey, 'at_spot');
  await companion.say(host.call.id, host.memberKey, 'at_spot');
  const bia = await companion.join(host.call.id, 'Bia');
  await companion.say(host.call.id, bia.memberKey, 'at_spot');

  // quem olha conta uma vez nos 15 minutos
  await companion.list('viewer-a');
  await companion.list('viewer-a');
  assert.equal((await companion.list('viewer-b')).watching, 2);
  clock.advance(16 * MINUTE);
  assert.equal((await companion.list('viewer-c')).watching, 1);

  // a moderação tira do ar, e as denúncias passam a dizer isso
  const late = await companion.open(
    request(new Date(clock.now() + 5 * MINUTE)),
  );
  await companion.report(late.call.id, { outsider: true }, 'spam');
  assert.equal(await companion.hideByModerator(late.call.id), 'hidden');
  assert.equal(await companion.hideByModerator(late.call.id), 'gone');
  const [report] = await companion.reportsForReview(1);
  assert.equal(report.hidden, true);
  assert.equal(report.source, 'outsider');

  const [today] = await companion.statsForReview(1);
  assert.equal(today.counts.opened_lunch, 2);
  assert.equal(today.counts.removed, 1);
  assert.equal(today.counts.phrase_at_spot, 3);
  assert.equal(today.counts.arrived_lunch, 1);
  assert.equal(today.counts.reports_outsider, 1);
  assert.equal(today.counts.hidden_moderation, 1);
  const lookers = Object.entries(today.counts)
    .filter(([key]) => key.startsWith('lookers_h'))
    .reduce((total, [, value]) => total + (value ?? 0), 0);
  assert.equal(lookers, 3);
});

test('the stored call keeps only hashes of the keys, the recent phrases and one report per member', async () => {
  const { companion, clock, models } = await open();
  const host = await companion.open(
    request(new Date(clock.now() + 5 * MINUTE)),
  );
  const ana = await companion.join(host.call.id, 'Ana');
  for (let i = 0; i < 65; i++)
    await companion.say(host.call.id, ana.memberKey, 'on_my_way');
  const read = await companion.read(host.call.id, host.memberKey);
  assert.equal(read.feed.length, 60);

  const stored = await models.companionCalls
    .findById(host.call.id)
    .lean<Record<string, unknown>>();
  const text = JSON.stringify(stored);
  assert.ok(!text.includes(host.memberKey.toString('base64url')));
  assert.ok(!text.includes(ana.memberKey.toString('base64url')));
  assert.equal('createdAt' in (stored ?? {}), false);

  await companion.report(host.call.id, { memberKey: ana.memberKey }, 'spam');
  await companion.report(host.call.id, { memberKey: ana.memberKey }, 'spam');
  assert.equal(await models.companionReports.countDocuments(), 1);

  // quem sai sai; quem chamou e sai encerra
  await companion.leave(host.call.id, ana.memberKey);
  assert.equal((await companion.read(host.call.id, host.memberKey)).going, 1);
  await companion.leave(host.call.id, host.memberKey);
  assert.deepEqual((await companion.list()).calls, []);

  // depois do prazo, a consulta já não acha (o TTL passa a cada minuto)
  clock.advance(40 * MINUTE);
  await assert.rejects(
    companion.read(host.call.id, host.memberKey),
    NotFoundError,
  );
});
