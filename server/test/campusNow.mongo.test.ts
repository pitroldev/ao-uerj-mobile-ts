import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { createDatabase } from '../src/adapters/outbound/mongo/connection.ts';
import { defineModels } from '../src/adapters/outbound/mongo/models.ts';
import { createMongoRepositories } from '../src/adapters/outbound/mongo/repositories.ts';
import { createCampusNow } from '../src/modules/campus-now/application.ts';
import {
  checkNotice,
  planNotice,
  type NoticeRequest,
} from '../src/modules/campus-now/domain.ts';
import { startMongo, type Mongo } from './mongo.ts';
import { silentLogger } from './support.ts';

// Agora no campus contra um mongod de verdade: as gravações de uma vez só
// (duas respostas juntas do mesmo aluno contam uma) e o lugar guardado.

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
    uri: mongo.getUri(`ao-uerj-campus-${++sequence}`),
    timeoutMs: 5000,
    logger: silentLogger,
  });
  assert.equal(await db.connect(), true);
  opened.push(db);
  const models = defineModels(db.connection);
  await Promise.all(Object.values(models).map(model => model.init()));
  return { models, repositories: createMongoRepositories(models) };
}

const room: NoticeRequest = {
  kind: 'access',
  status: 'room_locked',
  place: { type: 'room', block: 'B', floor: '6', room: '6019' },
};

test('the place goes flat into the database and comes back, and the states change once', async () => {
  const { repositories } = await open();
  const notices = repositories.campusNotices;
  const now = new Date();
  const notice = planNotice(checkNotice(room), {
    id: 'AAAAAAAAAAAAAAAA',
    reporter: 'marina',
    level: 1,
    now,
  });
  await notices.create(notice);
  const gate = planNotice(
    checkNotice({
      kind: 'access',
      status: 'gate_closed',
      place: { type: 'gate', gate: 'portao-sfx' },
    }),
    { id: 'BBBBBBBBBBBBBBBB', reporter: 'lucas', level: 4, now },
  );
  await notices.create(gate);
  assert.deepEqual((await notices.find(notice.id))?.place, room.place);
  assert.deepEqual((await notices.find(gate.id))?.place, {
    type: 'gate',
    gate: 'portao-sfx',
  });
  assert.equal((await notices.find(gate.id))?.trusted, true);
  assert.deepEqual(
    (await notices.listActive(now)).map(item => item.id).sort(),
    [notice.id, gate.id].sort(),
  );
  assert.deepEqual(
    (await notices.listActiveAt('access', 'room:B:6019', now)).map(
      item => item.id,
    ),
    [notice.id],
  );

  // o fim só vai para a frente
  const pushed = new Date(now.getTime() + 3 * 60 * MINUTE);
  assert.equal(
    (await notices.addConfirmation(notice.id, pushed))?.expiresAt.getTime(),
    pushed.getTime(),
  );
  assert.equal(
    (await notices.addConfirmation(notice.id, now))?.expiresAt.getTime(),
    pushed.getTime(),
  );
  assert.equal(await notices.markFirstConfirmed(notice.id, now), true);
  assert.equal(await notices.markFirstConfirmed(notice.id, now), false);
  assert.equal(await notices.end(notice.id, now, 'answers'), true);
  assert.equal(await notices.end(notice.id, now, 'reporter'), false);
  assert.equal(await notices.remove(gate.id, now, 'flags'), true);
  assert.equal(await notices.remove(gate.id, now, 'moderation'), false);
  assert.equal(await notices.setPenalized(gate.id, true), true);
  assert.equal(await notices.setPenalized(gate.id, true), false);
  assert.equal(await notices.restore(gate.id, now), true);
  assert.equal(await notices.restore(gate.id, now), false);
  assert.equal(await notices.countActive(now), 1);
  await notices.addViews([gate.id, notice.id]);
  assert.equal((await notices.find(gate.id))?.views, 1);
  // o do banido não volta
  await notices.remove(gate.id, now, 'ban');
  assert.equal(await notices.restore(gate.id, now), false);
});

test('each student answers, thanks, flags and sees a notice once, even at the same time', async () => {
  const { repositories } = await open();
  const answers = repositories.campusAnswers;
  const purge = new Date(Date.now() + DAY);

  const twice = await Promise.all([
    answers.answer('n1', 'lucas', 'confirm', purge),
    answers.answer('n1', 'lucas', 'confirm', purge),
  ]);
  assert.deepEqual(
    twice.map(result => (result ? 'counted' : 'already')).sort(),
    ['already', 'counted'],
  );
  // de "Continua" para "Acabou" vale uma vez; de volta, não
  assert.deepEqual(await answers.answer('n1', 'lucas', 'end', purge), {
    previous: 'confirm',
  });
  assert.equal(await answers.answer('n1', 'lucas', 'end', purge), null);
  assert.equal(await answers.answer('n1', 'lucas', 'confirm', purge), null);
  // a linha criada pela marca recebe a resposta depois
  assert.equal(await answers.mark('n2', 'ana', 'thanked', purge), true);
  assert.equal(await answers.mark('n2', 'ana', 'thanked', purge), false);
  assert.deepEqual(await answers.answer('n2', 'ana', 'end', purge), {
    previous: null,
  });
  const seen = await Promise.all([
    answers.see(
      [
        { id: 'n1', purgeAt: purge },
        { id: 'n2', purgeAt: purge },
      ],
      'ana',
    ),
    answers.see([{ id: 'n1', purgeAt: purge }], 'ana'),
  ]);
  assert.deepEqual(seen.flat().sort(), ['n1', 'n2']);
  assert.deepEqual(
    (await answers.forStudent('ana', ['n1', 'n2', 'n3']))
      .map(item => [item.notice, item.answer, item.thanked, item.seen])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    [
      ['n1', null, false, true],
      ['n2', 'end', true, true],
    ],
  );
});

test('the points never go below zero, and the day counts every student once', async () => {
  const { repositories } = await open();
  const people = repositories.campusPeople;
  const days = repositories.campusDays;
  const purge = new Date(Date.now() + DAY);
  const both = await Promise.all([
    people.add('marina', { points: 10, notices: 1 }),
    people.add('marina', { points: 3, answers: 1 }),
  ]);
  assert.ok(both.some(item => item.points === 13));
  assert.equal((await people.add('marina', { points: -50 })).points, 0);
  assert.equal((await people.find('marina'))?.points, 0);
  assert.equal((await people.find('marina'))?.notices, 1);
  assert.equal(await people.find('nobody'), null);

  await Promise.all([
    days.add('marina', '2026-11-23', 'notices', 1, purge),
    days.add('marina', '2026-11-23', 'answers', 1, purge),
  ]);
  const counts = await days.add('marina', '2026-11-23', 'notices', 1, purge);
  assert.deepEqual(counts, { notices: 2, answers: 1, thanks: 0 });
  await days.add('lucas', '2026-11-23', 'thanks', 1, purge);
  await days.add('lucas', '2026-11-24', 'thanks', 1, purge);
  assert.equal(await days.countDay('2026-11-23'), 2);
});

test('the list, the student, the summary, the flagged and the day are read by index', async () => {
  const { models } = await open();
  const now = new Date();
  /** O índice que o MongoDB escolheu para a consulta. */
  const indexOf = async (query: {
    explain(verbosity: string): Promise<unknown>;
  }) => {
    const plan = JSON.stringify(await query.explain('queryPlanner'));
    return /"indexName":"([^"]+)"/.exec(plan)?.[1] ?? 'COLLSCAN';
  };
  const notices = models.campusNotices;
  assert.equal(
    await indexOf(
      notices.find({
        endedAt: null,
        removedAt: null,
        expiresAt: { $gt: now },
      }),
    ),
    'endedAt_1_removedAt_1_expiresAt_1',
  );
  assert.equal(
    await indexOf(
      notices.find({
        endedAt: null,
        removedAt: null,
        expiresAt: { $gt: now },
        kind: 'ru',
        placeKey: 'ru',
      }),
    ),
    'endedAt_1_removedAt_1_expiresAt_1',
  );
  assert.equal(
    await indexOf(
      notices
        .find({ reporter: 'marina', createdAt: { $gte: now } })
        .sort({ createdAt: -1 }),
    ),
    'reporter_1_createdAt_-1',
  );
  assert.equal(
    await indexOf(
      notices
        .find({ createdAt: { $gte: new Date(now.getTime() - DAY), $lt: now } })
        .sort({ createdAt: 1 }),
    ),
    'createdAt_-1',
  );
  assert.equal(
    await indexOf(
      notices
        .find({ flags: { $gte: 1 }, createdAt: { $gte: now } })
        .sort({ createdAt: -1 }),
    ),
    'createdAt_-1',
  );
  assert.equal(
    await indexOf(models.campusDays.find({ day: '2026-11-23' })),
    'day_1',
  );
});

test('two answers of the same student at once count once, through the use cases', async () => {
  const { repositories } = await open();
  const service = createCampusNow({
    notices: repositories.campusNotices,
    answers: repositories.campusAnswers,
    contributors: repositories.campusPeople,
    days: repositories.campusDays,
  });
  const posted = await service.report(room, { studentId: 'marina' });
  const results = await Promise.allSettled([
    service.answer(posted.notice.id, 'confirm', { studentId: 'lucas' }),
    service.answer(posted.notice.id, 'confirm', { studentId: 'lucas' }),
  ]);
  assert.deepEqual(results.map(result => result.status).sort(), [
    'fulfilled',
    'rejected',
  ]);
  const stored = await repositories.campusNotices.find(posted.notice.id);
  assert.equal(stored?.confirmations, 1);
  assert.ok(stored?.firstConfirmedAt);
  assert.equal((await repositories.campusPeople.find('lucas'))?.points, 3);
  assert.equal((await repositories.campusPeople.find('marina'))?.points, 15);
  const list = await service.list({ studentId: 'lucas' });
  assert.equal(list.notices[0]?.answer, 'confirm');
  assert.equal(list.helpersToday, 2);
});
