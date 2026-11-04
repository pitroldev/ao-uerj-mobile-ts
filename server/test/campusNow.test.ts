import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, test } from 'node:test';

import { createServer, type Server } from '../src/composition.ts';
import { createCampusNow } from '../src/modules/campus-now/application.ts';
import {
  checkNotice,
  extendedExpiry,
  monthSummary,
  placeKey,
  planNotice,
  previousMonth,
  standing,
  weekdaysOf,
  weekStart,
  type Notice,
  type NoticeRequest,
} from '../src/modules/campus-now/domain.ts';
import { createPortalWatch } from '../src/modules/portal/application.ts';
import { DomainError, InvalidInputError } from '../src/shared/errors.ts';
import {
  manualClock,
  memoryAttachments,
  memoryCampusNow,
  memoryRepositories,
  silentLogger,
  switchableDatabase,
  testConfig,
} from './support.ts';
import { privateKeyEntry, signingKeys } from './tokens.ts';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Segunda, 23 de novembro de 2026, 14:10 em São Paulo. */
const MONDAY = Date.UTC(2026, 10, 23, 17, 10);

const marina = { studentId: 'marina' };
const lucas = { studentId: 'lucas' };
const ana = { studentId: 'ana' };
const bia = { studentId: 'bia' };

const lift = (status = 'long_queue'): NoticeRequest =>
  ({
    kind: 'elevators',
    status,
    place: { type: 'elevators' },
  }) as NoticeRequest;
const floor = (
  kind: NoticeRequest['kind'],
  status: string,
  block = 'B',
  at = '6',
): NoticeRequest =>
  ({
    kind,
    status,
    place: { type: 'floor', block, floor: at },
  }) as NoticeRequest;

const code = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (err) {
    return (err as DomainError).code;
  }
  return 'ok';
};

/* ----------------------------------------------------------------- domínio */

test('each status asks for its own kind of place, with the floors the block has', () => {
  assert.deepEqual(checkNotice(lift()).place, { type: 'elevators' });
  assert.deepEqual(
    checkNotice({
      kind: 'access',
      status: 'room_locked',
      place: { type: 'room', block: 'B', floor: '6', room: ' 6019b ' },
    }).place,
    { type: 'room', block: 'B', floor: '6', room: '6019B' },
  );
  // a situação de outro tipo é um pedido malformado
  assert.throws(
    () => checkNotice({ ...lift(), status: 'wifi_down' }),
    InvalidInputError,
  );
  const placeError = (request: unknown) => {
    try {
      checkNotice(request as NoticeRequest);
    } catch (err) {
      return (err as DomainError).code;
    }
    return 'ok';
  };
  assert.equal(
    placeError({ kind: 'ru', status: 'closed', place: { type: 'elevators' } }),
    'invalid_place',
  );
  assert.equal(
    placeError(floor('power', 'no_power', 'A', 'SE')),
    'invalid_place',
  );
  assert.equal(placeError(floor('power', 'no_power', 'F', 'SE')), 'ok');
  assert.equal(
    placeError(floor('power', 'no_power', 'B', '13')),
    'invalid_place',
  );
  assert.equal(
    placeError({
      kind: 'access',
      status: 'room_locked',
      place: { type: 'room', block: 'B', floor: '6', room: 'sala 1' },
    }),
    'invalid_place',
  );
  assert.equal(
    placeError({
      kind: 'access',
      status: 'gate_closed',
      place: { type: 'gate', gate: 'portao-2' },
    }),
    'invalid_place',
  );
  assert.equal(placeKey({ type: 'elevators' }), 'elevators');
  assert.equal(
    placeKey({ type: 'gate', gate: 'portao-sfx' }),
    'gate:portao-sfx',
  );
  assert.equal(
    placeKey({ type: 'floor', block: 'D', floor: '9' }),
    'floor:D:9',
  );
  assert.equal(
    placeKey({ type: 'room', block: 'B', floor: '6', room: '6019' }),
    'room:B:6019',
  );
});

test('the levels follow the points, and a "Continua" only pushes the end within 12 hours', () => {
  assert.deepEqual(standing(0), {
    points: 0,
    level: 1,
    levelAt: 0,
    nextLevelAt: 100,
  });
  assert.equal(standing(99).level, 1);
  assert.deepEqual(standing(100), {
    points: 100,
    level: 2,
    levelAt: 100,
    nextLevelAt: 300,
  });
  assert.equal(standing(300).level, 3);
  assert.deepEqual(standing(2500), {
    points: 2500,
    level: 5,
    levelAt: 2000,
    nextLevelAt: null,
  });
  assert.equal(standing(-20).points, 0);

  const created = new Date(MONDAY);
  const notice = planNotice(checkNotice(floor('power', 'no_power')), {
    id: 'n1',
    reporter: 'marina',
    level: 1,
    now: created,
  });
  assert.equal(notice.expiresAt.getTime(), MONDAY + 2 * HOUR);
  // uma hora depois, a luz ainda não voltou: vale duas horas a partir daí
  assert.equal(
    extendedExpiry(notice, new Date(MONDAY + HOUR)).getTime(),
    MONDAY + 3 * HOUR,
  );
  // nunca para trás, nunca além das 12 horas
  assert.equal(
    extendedExpiry(
      { ...notice, expiresAt: new Date(MONDAY + 5 * HOUR) },
      new Date(MONDAY + 10 * MINUTE),
    ).getTime(),
    MONDAY + 5 * HOUR,
  );
  assert.equal(
    extendedExpiry(notice, new Date(MONDAY + 11 * HOUR)).getTime(),
    MONDAY + 12 * HOUR,
  );
});

test('the week starts on Monday and the month counts its weekdays, in São Paulo', () => {
  assert.equal(weekStart(new Date(MONDAY)), '2026-11-23');
  // domingo à noite em São Paulo (já segunda em UTC) ainda é a semana anterior
  assert.equal(weekStart(new Date(Date.UTC(2026, 10, 30, 2, 0))), '2026-11-23');
  assert.equal(weekStart(new Date(Date.UTC(2026, 10, 30, 3, 0))), '2026-11-30');
  // 2 a 23 de novembro de 2026: 16 dias de segunda a sexta
  assert.equal(weekdaysOf('2026-11', new Date(MONDAY)), 16);
  assert.equal(weekdaysOf('2026-10', new Date(MONDAY)), 22);
  assert.equal(previousMonth('2026-01'), '2025-12');
  assert.equal(previousMonth('2026-11'), '2026-10');
});

test('the month joins confirmed notices by kind, status and area, the most repeated first', () => {
  const at = (day: number, hour: number) =>
    new Date(Date.UTC(2026, 10, day, hour + 3));
  const make = (
    id: string,
    request: NoticeRequest,
    created: Date,
    change: Partial<Notice> = {},
  ): Notice => ({
    ...planNotice(checkNotice(request), {
      id,
      reporter: 'x',
      level: 1,
      now: created,
    }),
    confirmations: 1,
    ...change,
  });
  const notices = [
    make('a', lift(), at(2, 13), {
      endedAt: at(2, 14),
      endedBy: 'answers',
    }),
    make('b', lift(), at(3, 13)),
    make('c', lift(), at(3, 7)),
    // outro bloco: outro problema
    make('d', floor('internet', 'wifi_down', 'A', '3'), at(4, 10)),
    make('e', floor('internet', 'wifi_down', 'A', '5'), at(5, 10)),
    make('f', floor('internet', 'wifi_down', 'B', '5'), at(5, 10)),
    // nem os novos sem confirmação nem os tirados do ar contam
    make('g', lift(), at(6, 13), { confirmations: 0 }),
    make('h', lift(), at(7, 13), { removedAt: at(7, 14) }),
  ];
  const summary = monthSummary(notices);
  assert.equal(summary.notices, 6);
  assert.deepEqual(
    summary.problems.map(problem => [
      problem.kind,
      problem.block,
      problem.days,
      problem.notices,
    ]),
    [
      ['elevators', null, 2, 3],
      ['internet', 'A', 2, 2],
      ['internet', 'B', 1, 1],
    ],
  );
  assert.deepEqual(summary.problems[0]?.peakHours, [13, 7]);
  assert.equal(summary.problems[0]?.minutesToEnd, 60);
  assert.equal(summary.problems[1]?.minutesToEnd, null);
});

/* ---------------------------------------------------------- casos de uso */

function campus(start = MONDAY) {
  const clock = manualClock(start);
  const memory = memoryCampusNow();
  const service = createCampusNow({
    notices: memory.noticeRepository,
    answers: memory.answerRepository,
    contributors: memory.contributorRepository,
    days: memory.dayRepository,
    now: clock.now,
    listCacheMs: 0,
    helpersCacheMs: 0,
    communityCacheMs: 0,
  });
  return { clock, memory, service };
}

test('a notice starts new, a second student confirms it, and both earn points', async () => {
  const { clock, memory, service } = campus();
  const posted = await service.report(lift(), marina);
  assert.equal(posted.merged, false);
  assert.equal(posted.notice.confirmed, false);
  assert.equal(posted.notice.mine, true);
  assert.equal(posted.notice.views, 0);
  assert.equal(posted.you.earned, 10);
  assert.equal(posted.you.points, 10);

  // quem vê de fora não sabe de quem é nem quantos viram
  const seen = await service.list(lucas);
  assert.equal(seen.notices.length, 1);
  assert.equal(seen.notices[0]?.mine, false);
  assert.equal(seen.notices[0]?.views, null);
  assert.equal(seen.helpersToday, 1);

  clock.advance(10 * MINUTE);
  // o mesmo aviso de outra pessoa vira a confirmação do que já existe
  const again = await service.report(lift(), lucas);
  assert.equal(again.merged, true);
  assert.equal(again.notice.id, posted.notice.id);
  assert.equal(again.notice.confirmed, true);
  assert.equal(again.notice.answer, 'confirm');
  assert.equal(again.you.earned, 3);
  assert.equal(again.notice.expiresAt.getTime(), MONDAY + 10 * MINUTE + HOUR);
  const stored = memory.people.get('marina');
  assert.equal(stored?.points, 15);
  assert.equal(stored?.confirmedNotices, 1);
  assert.equal(memory.notices.size, 1);

  // de novo, a mesma pessoa: nada muda; quem avisou também não confirma o dele
  const twice = await service.report(lift(), lucas);
  assert.equal(twice.merged, true);
  assert.equal(twice.you.earned, 0);
  const own = await service.report(lift(), marina);
  assert.equal(own.merged, true);
  assert.equal(own.you.earned, 0);
  assert.equal(memory.notices.get(posted.notice.id)?.confirmations, 1);
  assert.equal(
    await code(service.answer(posted.notice.id, 'confirm', marina)),
    'own_notice',
  );
  assert.equal(
    await code(service.answer(posted.notice.id, 'confirm', lucas)),
    'already_answered',
  );
  assert.equal((await service.list(ana)).helpersToday, 2);
});

test('a new situation in the same place ends the one before', async () => {
  const { clock, memory, service } = campus();
  const small = await service.report(
    { kind: 'ru', status: 'short_queue', place: { type: 'ru' } },
    marina,
  );
  clock.advance(5 * MINUTE);
  const big = await service.report(
    { kind: 'ru', status: 'long_queue', place: { type: 'ru' } },
    lucas,
  );
  assert.equal(big.merged, false);
  assert.equal(big.replaced, small.notice.id);
  assert.equal(memory.notices.get(small.notice.id)?.endedBy, 'replaced');
  assert.deepEqual(
    (await service.list(ana)).notices.map(notice => notice.status),
    ['long_queue'],
  );
});

test('two students posting the same at once keep one notice, the other confirms it', async () => {
  const { memory, service } = campus();
  const results = await Promise.all([
    service.report(lift(), marina),
    service.report(lift(), lucas),
  ]);
  const live = (await service.list(ana)).notices;
  assert.equal(live.length, 1);
  assert.equal(live[0]?.confirmations, 1);
  assert.deepEqual(
    results.map(result => Number(result.merged)).sort((a, b) => a - b),
    [0, 1],
  );
  assert.equal(
    [...memory.notices.values()].filter(notice => !notice.endedAt).length,
    1,
  );
});

test('three "Acabou" end a notice; the reporter ends it at once; confirm can turn into end only', async () => {
  const { memory, service } = campus();
  const posted = await service.report(floor('power', 'no_power'), marina);
  const id = posted.notice.id;
  const first = await service.answer(id, 'confirm', lucas);
  assert.equal(first.you.earned, 3);
  // do "Continua" ao "Acabou": vale, sem pontos de novo
  const changed = await service.answer(id, 'end', lucas);
  assert.equal(changed.you.earned, 0);
  assert.equal(changed.notice.answer, 'end');
  assert.equal(
    await code(service.answer(id, 'confirm', lucas)),
    'already_answered',
  );
  assert.equal(
    await code(service.answer(id, 'end', lucas)),
    'already_answered',
  );
  await service.answer(id, 'end', ana);
  const last = await service.answer(id, 'end', bia);
  assert.equal(last.notice.state, 'ended');
  assert.equal(memory.notices.get(id)?.endedBy, 'answers');
  assert.equal((await service.list(ana)).notices.length, 0);
  assert.equal(
    await code(service.answer(id, 'end', { studentId: 'x' })),
    'notice_not_found',
  );

  // "Já resolveu": quem avisou encerra na hora
  const other = await service.report(floor('internet', 'wifi_down'), marina);
  const done = await service.answer(other.notice.id, 'end', marina);
  assert.equal(done.notice.state, 'ended');
  assert.equal(memory.notices.get(other.notice.id)?.endedBy, 'reporter');
});

test('two answers of the same student at once count once', async () => {
  const { memory, service } = campus();
  const posted = await service.report(lift(), marina);
  const results = await Promise.allSettled([
    service.answer(posted.notice.id, 'confirm', lucas),
    service.answer(posted.notice.id, 'confirm', lucas),
  ]);
  assert.deepEqual(results.map(result => result.status).sort(), [
    'fulfilled',
    'rejected',
  ]);
  assert.equal(memory.notices.get(posted.notice.id)?.confirmations, 1);
  assert.equal(memory.people.get('lucas')?.points, 3);
});

test('three "Não é verdade" take the notice down and the reporter loses points; the moderation can bring it back', async () => {
  const { memory, service } = campus();
  await memory.contributorRepository.add('marina', { points: 100 });
  const posted = await service.report(lift(), marina);
  const id = posted.notice.id;
  assert.equal(await code(service.flag(id, marina)), 'own_notice');
  await service.flag(id, lucas);
  await service.flag(id, lucas);
  await service.flag(id, ana);
  assert.equal(memory.notices.get(id)?.removedAt, null);
  await service.flag(id, bia);
  assert.equal(memory.notices.get(id)?.removedBy, 'flags');
  assert.equal(memory.people.get('marina')?.points, 110 - 15);
  assert.equal((await service.list(ana)).notices.length, 0);
  assert.equal(await service.pendingFlags(), 1);

  assert.equal(await service.restoreByModerator(id), 'restored');
  assert.equal(memory.notices.get(id)?.removedAt, null);
  assert.equal(memory.people.get('marina')?.points, 110);
  assert.equal(await service.pendingFlags(), 0);
  // a moderação manteve: outra denúncia não tira mais sozinha
  await service.flag(id, { studentId: 'caio' });
  assert.equal(memory.notices.get(id)?.removedAt, null);

  // tirar do ar pela moderação tira os pontos uma vez só
  assert.equal(await service.removeByModerator(id), 'removed');
  assert.equal(await service.removeByModerator(id), 'removed');
  assert.equal(memory.people.get('marina')?.points, 95);
  assert.equal(await service.removeByModerator('nope'), 'gone');

  // os pontos nunca ficam negativos
  const fresh = await service.report(floor('power', 'no_ac'), lucas);
  await memory.contributorRepository.add('lucas', { points: -100 });
  await service.removeByModerator(fresh.notice.id);
  assert.equal(memory.people.get('lucas')?.points, 0);
});

test('thanks reach the reporter once, and nobody thanks their own notice', async () => {
  const { memory, service } = campus();
  const posted = await service.report(lift(), marina);
  const thanked = await service.thank(posted.notice.id, lucas);
  assert.equal(thanked.notice.thanked, true);
  await service.thank(posted.notice.id, lucas);
  assert.equal(memory.notices.get(posted.notice.id)?.thanks, 1);
  assert.equal(memory.people.get('marina')?.thanksReceived, 1);
  assert.equal(memory.people.get('marina')?.points, 11);
  assert.equal(
    await code(service.thank(posted.notice.id, marina)),
    'own_notice',
  );
  const mine = (await service.list(marina)).notices[0];
  assert.equal(mine?.thanks, 1);
});

test('only the first notices and answers of the day give points, and the day has a ceiling', async () => {
  const { clock, service } = campus();
  const kinds: NoticeRequest[] = [
    lift(),
    { kind: 'ru', status: 'long_queue', place: { type: 'ru' } },
    floor('power', 'no_power', 'A', '1'),
    floor('power', 'no_power', 'A', '2'),
    floor('power', 'no_power', 'A', '3'),
    floor('power', 'no_power', 'A', '4'),
    floor('power', 'no_power', 'A', '5'),
    floor('power', 'no_power', 'A', '6'),
    floor('power', 'no_power', 'A', '7'),
    floor('power', 'no_power', 'A', '8'),
  ];
  const earned: number[] = [];
  for (const request of kinds)
    earned.push((await service.report(request, marina)).you.earned);
  assert.deepEqual(earned, [10, 10, 10, 10, 10, 0, 0, 0, 0, 0]);
  assert.equal(
    await code(service.report(floor('power', 'no_power', 'A', '9'), marina)),
    'notice_limit_reached',
  );
  // as respostas: só as dez primeiras dão pontos
  const answered: number[] = [];
  const list = (await service.list(lucas)).notices;
  for (const notice of list)
    answered.push(
      (await service.answer(notice.id, 'confirm', lucas)).you.earned,
    );
  const posted = await service.report(floor('power', 'no_ac', 'B', '1'), ana);
  answered.push(
    (await service.answer(posted.notice.id, 'confirm', lucas)).you.earned,
  );
  assert.deepEqual(answered, [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0]);
  // no dia seguinte, o limite recomeça
  clock.advance(DAY);
  assert.equal(
    (await service.report(floor('power', 'no_power', 'A', '9'), marina)).you
      .earned,
    10,
  );
});

test('from level 3, a notice is worth it at once and shows the level', async () => {
  const { memory, service } = campus();
  await memory.contributorRepository.add('marina', { points: 320 });
  const posted = await service.report(lift(), marina);
  assert.equal(posted.notice.confirmed, true);
  assert.equal(posted.notice.level, 3);
  const plain = await service.report(floor('power', 'no_power'), lucas);
  assert.equal(plain.notice.level, null);
});

test('a notice disappears by itself, later if someone confirms it', async () => {
  const { clock, service } = campus();
  const posted = await service.report(
    { kind: 'ru', status: 'short_queue', place: { type: 'ru' } },
    marina,
  );
  clock.advance(20 * MINUTE);
  await service.answer(posted.notice.id, 'confirm', lucas);
  clock.advance(20 * MINUTE);
  assert.equal((await service.list(ana)).notices.length, 1);
  clock.advance(11 * MINUTE);
  assert.equal((await service.list(ana)).notices.length, 0);
  const today = (await service.you(marina)).today;
  assert.equal(today[0]?.state, 'expired');
});

test('views count once per student, never the reporter, and reach the reporter', async () => {
  const { memory, service } = campus();
  const posted = await service.report(lift(), marina);
  const other = await service.report(floor('power', 'no_power'), lucas);
  await service.seen(
    [posted.notice.id, other.notice.id, 'AAAAAAAAAAAAAAAA'],
    lucas,
  );
  await service.seen([posted.notice.id], lucas);
  await service.seen([posted.notice.id], ana);
  await service.seen([posted.notice.id], marina);
  assert.equal(memory.notices.get(posted.notice.id)?.views, 2);
  assert.equal(memory.notices.get(other.notice.id)?.views, 0);
  assert.equal(memory.people.get('marina')?.viewsReceived, 2);
});

test('the student sees the points, the week and the notices of today', async () => {
  const { clock, service } = campus();
  // semana passada: não entra
  clock.advance(-2 * DAY);
  await service.report(floor('power', 'no_power', 'C', '2'), marina);
  clock.advance(2 * DAY);
  const posted = await service.report(lift(), marina);
  await service.thank(posted.notice.id, lucas);
  await service.seen([posted.notice.id], lucas);
  clock.advance(MINUTE);
  const removed = await service.report(floor('power', 'no_ac'), marina);
  await service.removeByModerator(removed.notice.id);
  const you = await service.you(marina);
  assert.equal(you.counts.notices, 3);
  assert.equal(you.week.notices, 1);
  assert.equal(you.week.views, 1);
  assert.equal(you.week.thanks, 1);
  assert.deepEqual(
    you.today.map(notice => [notice.kind, notice.state]),
    [
      ['power', 'removed'],
      ['elevators', 'active'],
    ],
  );
  assert.equal(you.you.points, 30 + 1 - 15);
});

test('the community has this week and this month or the one before, never older', async () => {
  const { clock, service } = campus();
  const posted = await service.report(lift(), marina);
  await service.answer(posted.notice.id, 'confirm', lucas);
  clock.advance(30 * MINUTE);
  await service.answer(posted.notice.id, 'end', ana);
  await service.answer(posted.notice.id, 'end', bia);
  await service.answer(posted.notice.id, 'end', { studentId: 'caio' });
  const community = await service.community(null);
  assert.equal(community.week.from, '2026-11-23');
  assert.equal(community.week.notices, 1);
  assert.equal(community.week.answers, 4);
  assert.equal(community.week.minutesToEnd, 30);
  assert.equal(community.month.month, '2026-11');
  assert.equal(community.month.weekdays, 16);
  assert.equal(community.month.problems[0]?.kind, 'elevators');
  assert.equal((await service.community('2026-10')).month.problems.length, 0);
  assert.equal(await code(service.community('2026-09')), 'invalid_request');
});

test('a banned student loses the notices that are still on, and the campus has a ceiling', async () => {
  const { memory, service } = campus();
  const posted = await service.report(lift(), marina);
  await service.dropStudent('marina');
  assert.equal(memory.notices.get(posted.notice.id)?.removedBy, 'ban');
  // o do banido não volta pela moderação
  assert.equal(await service.restoreByModerator(posted.notice.id), 'gone');

  for (let i = 0; i < 300; i++)
    await memory.noticeRepository.create(
      planNotice(checkNotice(lift('stopped')), {
        id: `full-${i}`,
        reporter: `s${i}`,
        level: 1,
        now: new Date(MONDAY),
      }),
    );
  assert.equal(
    await code(service.report(floor('power', 'no_power'), lucas)),
    'campus_full',
  );
});

/* -------------------------------------------------------------------- HTTP */

const [key] = signingKeys(1);
const ADMIN = 'c'.repeat(48);
const DATA_KEY = randomBytes(32);
const opened: Server[] = [];

after(async () => {
  await Promise.all(opened.map(server => server.stop()));
});

async function serve() {
  const memory = memoryRepositories();
  const db = switchableDatabase();
  const server = createServer(
    testConfig({
      PRIVATE_TOKEN_KEYS: privateKeyEntry(key),
      ADMIN_TOKEN: ADMIN,
      TOKEN_ATTESTATION: 'development',
      STUDENT_DATA_KEY: DATA_KEY.toString('base64'),
    }),
    silentLogger,
    {
      database: db.database,
      repositories: memory.repositories,
      attachments: memoryAttachments().store,
      portal: createPortalWatch({ probe: async () => 200 }),
    },
  );
  opened.push(server);
  const { port } = await server.start(0);
  let cookie = '';
  const call = async (
    method: 'GET' | 'POST',
    path: string,
    {
      headers = {},
      json,
      form,
      admin = false,
    }: {
      headers?: Record<string, string>;
      json?: object;
      form?: Record<string, string>;
      admin?: boolean;
    } = {},
  ) => {
    const init: RequestInit = {
      method,
      redirect: 'manual',
      headers: {
        ...(json ? { 'content-type': 'application/json' } : {}),
        ...(form
          ? { 'content-type': 'application/x-www-form-urlencoded' }
          : {}),
        ...(admin && cookie ? { cookie } : {}),
        ...headers,
      },
    };
    if (json) init.body = JSON.stringify(json);
    if (form) init.body = new URLSearchParams(form).toString();
    const response = await fetch(`http://127.0.0.1:${port}${path}`, init);
    const text = await response.text();
    let body: any = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    return { status: response.status, response, body, text };
  };
  const signIn = async (matricula: string, name: string) => {
    const challenge = await call('GET', '/aouerj/v2/students/challenge');
    const session = await call('POST', '/aouerj/v2/students/session', {
      json: {
        challenge: challenge.body.challenge,
        installation: randomBytes(32).toString('base64url'),
        integrityToken: 'development',
        matricula,
        name,
      },
    });
    assert.equal(session.status, 201);
    return {
      id: session.body.student.id as string,
      headers: { authorization: `Student ${session.body.session}` },
    };
  };
  const adminSignIn = async () => {
    const answer = await call('POST', '/aouerj/admin/entrar', {
      form: { token: ADMIN },
    });
    assert.equal(answer.status, 303);
    cookie =
      (answer.response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  };
  return { call, signIn, adminSignIn, memory, db };
}

const BASE = '/aouerj/v2/campus-now';

test('the campus routes ask for the student session and check every field', async () => {
  const { call, signIn } = await serve();
  assert.equal((await call('GET', BASE)).status, 401);
  assert.equal(
    (await call('POST', `${BASE}/notices`, { json: lift() })).status,
    401,
  );
  const marinaIn = await signIn('201810012345', 'MARINA COSTA');
  const bad = await call('POST', `${BASE}/notices`, {
    headers: marinaIn.headers,
    json: { kind: 'elevators', status: 'nope', place: { type: 'elevators' } },
  });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'invalid_request');
  const wrongPlace = await call('POST', `${BASE}/notices`, {
    headers: marinaIn.headers,
    json: { kind: 'ru', status: 'closed', place: { type: 'elevators' } },
  });
  assert.equal(wrongPlace.status, 422);
  assert.equal(wrongPlace.body.error, 'invalid_place');
  const noPlace = await call('POST', `${BASE}/notices`, {
    headers: marinaIn.headers,
    json: { kind: 'ru', status: 'closed', place: { type: 'roof' } },
  });
  assert.equal(noPlace.status, 400);
  const missing = await call('POST', `${BASE}/notices/xyz/answer`, {
    headers: marinaIn.headers,
    json: { answer: 'confirm' },
  });
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error, 'notice_not_found');
  const month = await call('GET', `${BASE}/community?month=2020-01`, {
    headers: marinaIn.headers,
  });
  assert.equal(month.status, 400);
  const malformed = await call('GET', `${BASE}/community?month=nov`, {
    headers: marinaIn.headers,
  });
  assert.equal(malformed.status, 400);
});

test('two students post, confirm, thank, see and read their week over HTTP', async () => {
  const { call, signIn, memory } = await serve();
  const marinaIn = await signIn('201810012345', 'MARINA COSTA');
  const lucasIn = await signIn('201910054321', 'LUCAS SOUZA');

  const posted = await call('POST', `${BASE}/notices`, {
    headers: marinaIn.headers,
    json: {
      kind: 'access',
      status: 'room_locked',
      place: { type: 'room', block: 'B', floor: '6', room: '6019' },
    },
  });
  assert.equal(posted.status, 201);
  assert.equal(posted.response.headers.get('cache-control'), 'no-store');
  const id = posted.body.notice.id as string;
  assert.match(id, /^[A-Za-z0-9_-]{16}$/);
  assert.equal(posted.body.notice.state, 'active');
  assert.equal(posted.body.notice.confirmed, false);
  assert.equal(posted.body.merged, false);
  assert.equal(posted.body.replaced, null);
  assert.deepEqual(posted.body.you, {
    points: 10,
    level: 1,
    levelAt: 0,
    nextLevelAt: 100,
    earned: 10,
  });
  assert.equal(memory.data.campusNotices.get(id)?.reporter, marinaIn.id);

  const list = await call('GET', BASE, { headers: lucasIn.headers });
  assert.equal(list.status, 200);
  assert.equal(list.body.helpersToday, 1);
  assert.deepEqual(list.body.you, {
    points: 0,
    level: 1,
    levelAt: 0,
    nextLevelAt: 100,
  });
  const seenByLucas = list.body.notices[0];
  assert.equal(seenByLucas.mine, false);
  assert.equal(seenByLucas.views, null);
  assert.equal(seenByLucas.thanks, null);
  assert.deepEqual(seenByLucas.place, {
    type: 'room',
    block: 'B',
    floor: '6',
    room: '6019',
  });
  assert.equal(typeof seenByLucas.createdAt, 'string');

  const seen = await call('POST', `${BASE}/seen`, {
    headers: lucasIn.headers,
    json: { ids: [id, 'not-an-id'] },
  });
  assert.equal(seen.status, 200);
  const confirmed = await call('POST', `${BASE}/notices/${id}/answer`, {
    headers: lucasIn.headers,
    json: { answer: 'confirm' },
  });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.notice.confirmed, true);
  assert.equal(confirmed.body.notice.answer, 'confirm');
  assert.equal(confirmed.body.you.earned, 3);
  const again = await call('POST', `${BASE}/notices/${id}/answer`, {
    headers: lucasIn.headers,
    json: { answer: 'confirm' },
  });
  assert.equal(again.status, 409);
  assert.equal(again.body.error, 'already_answered');
  const own = await call('POST', `${BASE}/notices/${id}/thanks`, {
    headers: marinaIn.headers,
  });
  assert.equal(own.status, 403);
  assert.equal(own.body.error, 'own_notice');
  const thanked = await call('POST', `${BASE}/notices/${id}/thanks`, {
    headers: lucasIn.headers,
  });
  assert.equal(thanked.status, 200);
  assert.equal(thanked.body.notice.thanked, true);
  const flagged = await call('POST', `${BASE}/notices/${id}/flag`, {
    headers: lucasIn.headers,
  });
  assert.deepEqual(flagged.body, { status: 'ok' });

  const mine = await call('GET', BASE, { headers: marinaIn.headers });
  assert.equal(mine.body.notices[0].mine, true);
  assert.equal(mine.body.notices[0].views, 1);
  assert.equal(mine.body.notices[0].thanks, 1);

  const you = await call('GET', `${BASE}/you`, { headers: marinaIn.headers });
  assert.equal(you.status, 200);
  assert.equal(you.body.you.points, 10 + 5 + 1);
  assert.deepEqual(you.body.counts, {
    notices: 1,
    answers: 0,
    confirmedNotices: 1,
    thanksReceived: 1,
    viewsReceived: 1,
  });
  assert.deepEqual(you.body.week, { notices: 1, views: 1, thanks: 1 });
  assert.equal(you.body.today.length, 1);

  const community = await call('GET', `${BASE}/community`, {
    headers: lucasIn.headers,
  });
  assert.equal(community.status, 200);
  assert.match(community.body.week.from, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(community.body.month.problems[0].kind, 'access');
  assert.equal(community.body.month.problems[0].block, 'B');

  // "Já resolveu"
  const ended = await call('POST', `${BASE}/notices/${id}/answer`, {
    headers: marinaIn.headers,
    json: { answer: 'end' },
  });
  assert.equal(ended.status, 200);
  assert.equal(ended.body.notice.state, 'ended');
  const later = await call('GET', BASE, { headers: lucasIn.headers });
  assert.equal(later.body.notices.length, 0);
});

test('the admin tab lists the flagged notices with the reporter and takes them down with the csrf', async () => {
  const { call, signIn, adminSignIn, memory } = await serve();
  const marinaIn = await signIn('201810012345', 'MARINA COSTA');
  const lucasIn = await signIn('201910054321', 'LUCAS SOUZA');
  const posted = await call('POST', `${BASE}/notices`, {
    headers: marinaIn.headers,
    json: lift('stopped'),
  });
  const id = posted.body.notice.id as string;
  await call('POST', `${BASE}/notices/${id}/flag`, {
    headers: lucasIn.headers,
  });

  assert.equal((await call('GET', '/aouerj/admin/agora')).status, 401);
  await adminSignIn();
  const tab = await call('GET', '/aouerj/admin/agora', { admin: true });
  assert.equal(tab.status, 200);
  assert.match(tab.text, /Elevadores: todos parados/);
  assert.match(tab.text, /MARINA COSTA/);
  assert.match(tab.text, /1 denúncia/);
  // a aba conta o denunciado que espera a moderação, nas outras páginas também
  const reports = await call('GET', '/aouerj/admin', { admin: true });
  assert.match(reports.text, /Agora no campus<span class="n">1<\/span>/);
  const csrf = /name="csrf" value="([^"]+)"/.exec(tab.text)?.[1] ?? '';

  const forged = await call('POST', `/aouerj/admin/agora/${id}/tirar`, {
    admin: true,
    form: { csrf: 'outro' },
  });
  assert.equal(forged.status, 403);
  const removed = await call('POST', `/aouerj/admin/agora/${id}/tirar`, {
    admin: true,
    form: { csrf },
  });
  assert.equal(removed.status, 303);
  assert.match(removed.response.headers.get('location') ?? '', /feito=tirado/);
  assert.equal(memory.data.campusNotices.get(id)?.removedBy, 'moderation');
  const list = await call('GET', BASE, { headers: lucasIn.headers });
  assert.equal(list.body.notices.length, 0);
  const back = await call('POST', `/aouerj/admin/agora/${id}/voltar`, {
    admin: true,
    form: { csrf },
  });
  assert.match(back.response.headers.get('location') ?? '', /feito=mantido/);
  assert.equal(memory.data.campusNotices.get(id)?.removedAt, null);
  const gone = await call('POST', '/aouerj/admin/agora/nada/voltar', {
    admin: true,
    form: { csrf },
  });
  assert.match(gone.response.headers.get('location') ?? '', /feito=sumiu/);

  // o banido sai do ar na hora
  const page = await call('GET', `/aouerj/admin/alunos/${marinaIn.id}`, {
    admin: true,
  });
  assert.equal(page.status, 200);
  await call('POST', `/aouerj/admin/alunos/${marinaIn.id}/banir`, {
    admin: true,
    form: { csrf, prazo: '7', motivo: 'Avisos falsos' },
  });
  assert.equal(memory.data.campusNotices.get(id)?.removedBy, 'ban');
});
