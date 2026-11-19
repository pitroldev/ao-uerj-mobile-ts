import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { createDatabase } from '../src/adapters/outbound/mongo/connection.ts';
import { defineModels } from '../src/adapters/outbound/mongo/models.ts';
import { createMongoRepositories } from '../src/adapters/outbound/mongo/repositories.ts';
import { startMongo, type Mongo } from './mongo.ts';
import { silentLogger } from './support.ts';

/*
 * Os avisos do portal no iPhone no MongoDB: o pedido de "Avisar quando
 * voltar" sai uma vez só, e o cutucão, uma vez a cada 4 horas.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const TOKEN = 'ab'.repeat(32);

let mongo: Mongo;
let sequence = 0;
const opened: { disconnect(): Promise<void> }[] = [];

before(async () => {
  mongo = await startMongo();
});

after(async () => {
  await Promise.all(opened.map(db => db.disconnect()));
  await mongo.stop();
});

async function open() {
  const db = createDatabase({
    uri: mongo.getUri(`ao-uerj-portal-${++sequence}`),
    timeoutMs: 5000,
    logger: silentLogger,
  });
  assert.equal(await db.connect(), true);
  opened.push(db);
  const models = defineModels(db.connection);
  await Promise.all(Object.values(models).map(model => model.init()));
  return { models, repositories: createMongoRepositories(models) };
}

test('"Avisar quando voltar": one per student and per token, claimed once, restored only without a newer one', async () => {
  const { repositories } = await open();
  const alerts = repositories.portalReturnAlerts;
  const now = new Date();
  const alert = (student: string, requestedAt = now) => ({
    student,
    device: { platform: 'ios' as const, token: TOKEN },
    requestedAt,
    expiresAt: new Date(requestedAt.getTime() + 3 * DAY),
  });
  await alerts.put(alert('marina'));
  // o mesmo aparelho, outra conta: a anterior sai
  await alerts.put(alert('lucas'));
  assert.equal(await alerts.find('marina', now), null);
  const stored = await alerts.find('lucas', now);
  assert.equal(stored?.device.token, TOKEN);

  // só os pedidos de antes do teste do portal
  assert.deepEqual(await alerts.listRequestedBefore(now, now), []);
  const later = new Date(now.getTime() + MINUTE);
  const [due] = await alerts.listRequestedBefore(later, later);
  assert.equal(due?.student, 'lucas');

  // um envio só, mesmo com dois juntos (as duas cores)
  const claims = await Promise.all([alerts.claim(due), alerts.claim(due)]);
  assert.deepEqual(claims.sort(), [false, true]);
  assert.equal(await alerts.find('lucas', now), null);

  // o aviso não chegou: volta; com um pedido novo no lugar, fica o novo
  await alerts.restore(due);
  assert.equal(
    (await alerts.find('lucas', now))?.requestedAt.getTime(),
    now.getTime(),
  );
  await alerts.put(alert('lucas', later));
  await alerts.restore(due);
  assert.equal(
    (await alerts.find('lucas', now))?.requestedAt.getTime(),
    later.getTime(),
  );
  // o pedido velho não leva o novo
  assert.equal(await alerts.claim(due), false);

  // vencido, não aparece
  const expired = new Date(now.getTime() + 4 * DAY);
  assert.equal(await alerts.find('lucas', expired), null);
  assert.deepEqual(await alerts.listRequestedBefore(expired, expired), []);
  await alerts.remove('lucas');
  assert.equal(await alerts.find('lucas', now), null);
});

test('the nudge device: one owner per token, the 4-hour wake once, the dead token gone', async () => {
  const { repositories } = await open();
  const devices = repositories.portalPushDevices;
  const now = new Date();
  const entry = (student: string) => ({
    student,
    device: { platform: 'ios' as const, token: TOKEN },
    updatedAt: now,
    expiresAt: new Date(now.getTime() + 7 * DAY),
  });
  await devices.put(entry('marina'));
  assert.equal((await devices.find('marina', now))?.wokenAt, null);
  await devices.put(entry('lucas'));
  assert.equal(await devices.find('marina', now), null);

  const since = new Date(now.getTime() - 4 * HOUR);
  const claims = await Promise.all([
    devices.claimWake('lucas', now, since),
    devices.claimWake('lucas', now, since),
  ]);
  assert.deepEqual(claims.sort(), [false, true]);
  assert.deepEqual(await devices.listWakeable(now, since), []);
  // o registro de novo não zera o último cutucão
  await devices.put(entry('lucas'));
  assert.equal(
    (await devices.find('lucas', now))?.wokenAt?.getTime(),
    now.getTime(),
  );
  const fourHoursLater = new Date(now.getTime() + 4 * HOUR + MINUTE);
  assert.deepEqual(
    (
      await devices.listWakeable(
        fourHoursLater,
        new Date(now.getTime() + MINUTE),
      )
    ).map(item => item.student),
    ['lucas'],
  );

  // a Apple recusou o token: só sai se ainda for o mesmo
  await devices.forget('lucas', 'cd'.repeat(32));
  assert.ok(await devices.find('lucas', now));
  await devices.forget('lucas', TOKEN);
  assert.equal(await devices.find('lucas', now), null);
});

test('the TTL indexes of both collections', async () => {
  const { models } = await open();
  for (const model of [models.portalReturnAlerts, models.portalPushDevices]) {
    const indexes = await model.collection.indexes();
    const ttl = indexes.find(index => index.key.expiresAt === 1);
    assert.equal(ttl?.expireAfterSeconds, 0, model.collection.collectionName);
    assert.ok(indexes.some(index => index.key.token === 1));
  }
});
