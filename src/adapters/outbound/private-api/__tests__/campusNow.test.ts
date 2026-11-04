import { AxiosError, type AxiosResponse } from 'axios';
import { CampusNowError } from '@root/modules/campus-now/domain/campusNow';
import { AppError } from '@root/shared/errors/AppError';
import { createCampusNowServer } from '../campusNow';
import type { PrivateApiHttpClient } from '../index';

const rejected = (status: number, error?: string) =>
  new AxiosError('request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: '',
    data: error ? { error, message: '' } : {},
    headers: {},
    config: {},
  } as AxiosResponse);

const NOTICE = {
  id: 'Ab12Cd34Ef56Gh78',
  kind: 'elevators',
  status: 'long_queue',
  place: { type: 'elevators' },
  createdAt: '2026-11-23T16:41:00.000Z',
  expiresAt: '2026-11-23T17:41:00.000Z',
  state: 'active',
  confirmations: 7,
  ends: 1,
  confirmed: true,
  level: 4,
  mine: false,
  answer: null,
  thanked: false,
  flagged: false,
  views: null,
  thanks: null,
};
const YOU = { points: 290, level: 2, levelAt: 100, nextLevelAt: 300 };

function setup() {
  const client: jest.Mocked<PrivateApiHttpClient> = {
    get: jest.fn(),
    post: jest.fn(),
  };
  return { client, server: createCampusNowServer(client) };
}

it('reads the notices, how many helped today and the points', async () => {
  const { client, server } = setup();
  client.get.mockResolvedValueOnce({
    data: {
      notices: [
        NOTICE,
        {
          ...NOTICE,
          id: 'room',
          kind: 'access',
          status: 'room_locked',
          place: { type: 'room', block: 'B', floor: '6', room: '6019' },
          mine: true,
          level: null,
          views: 12,
          thanks: 3,
          answer: 'confirm',
        },
      ],
      helpersToday: 214,
      you: YOU,
    },
  });
  const list = await server.list();
  expect(client.get).toHaveBeenCalledWith('/v2/campus-now', undefined);
  expect(list.helpersToday).toBe(214);
  expect(list.you).toEqual(YOU);
  expect(list.notices[0]).toMatchObject({
    id: 'Ab12Cd34Ef56Gh78',
    createdAt: Date.parse(NOTICE.createdAt),
    level: 4,
    answer: null,
  });
  expect(list.notices[1]).toMatchObject({
    place: { type: 'room', block: 'B', floor: '6', room: '6019' },
    views: 12,
    answer: 'confirm',
  });
});

it('refuses an answer it cannot read', async () => {
  const { client, server } = setup();
  for (const broken of [
    { ...NOTICE, kind: 'fire' },
    { ...NOTICE, place: { type: 'floor', block: 'G', floor: '3' } },
    { ...NOTICE, place: { type: 'floor', block: 'A', floor: '13' } },
    { ...NOTICE, place: { type: 'room', block: 'A', floor: '3', room: '<b>' } },
    { ...NOTICE, confirmations: -1 },
    { ...NOTICE, createdAt: 'ontem' },
  ]) {
    client.get.mockResolvedValueOnce({
      data: { notices: [broken], helpersToday: 1, you: YOU },
    });
    await expect(server.list()).rejects.toEqual(
      new AppError('SERVICE_UNAVAILABLE'),
    );
  }
});

it('sends a notice and reads the result with the points', async () => {
  const { client, server } = setup();
  client.post.mockResolvedValueOnce({
    data: {
      notice: { ...NOTICE, mine: true, views: 0, thanks: 0, level: null },
      merged: false,
      replaced: 'old',
      you: {
        ...YOU,
        points: 300,
        level: 3,
        levelAt: 300,
        nextLevelAt: 800,
        earned: 10,
      },
    },
  });
  const result = await server.report({
    kind: 'elevators',
    status: 'long_queue',
    place: { type: 'elevators' },
  });
  expect(client.post).toHaveBeenCalledWith('/v2/campus-now/notices', {
    kind: 'elevators',
    status: 'long_queue',
    place: { type: 'elevators' },
  });
  expect(result).toMatchObject({
    merged: false,
    replaced: 'old',
    you: { level: 3, earned: 10 },
  });
});

it('answers, thanks, flags and counts what was seen in batches of 50', async () => {
  const { client, server } = setup();
  client.post.mockResolvedValue({
    data: { notice: NOTICE, you: { ...YOU, earned: 3 } },
  });
  await server.answer('a/b', 'end');
  expect(client.post).toHaveBeenLastCalledWith(
    '/v2/campus-now/notices/a%2Fb/answer',
    { answer: 'end' },
  );
  await server.thank('n1');
  expect(client.post).toHaveBeenLastCalledWith(
    '/v2/campus-now/notices/n1/thanks',
    {},
  );
  await server.flag('n1');
  expect(client.post).toHaveBeenLastCalledWith(
    '/v2/campus-now/notices/n1/flag',
    {},
  );
  client.post.mockClear();
  const ids = Array.from({ length: 120 }, (_, i) => `id${i}`);
  await server.seen(ids);
  expect(client.post).toHaveBeenCalledTimes(3);
  expect(
    client.post.mock.calls.map(
      ([, body]) => (body as { ids: string[] }).ids.length,
    ),
  ).toEqual([50, 50, 20]);
});

it('reads the student summary and the community of a month', async () => {
  const { client, server } = setup();
  client.get.mockResolvedValueOnce({
    data: {
      you: YOU,
      counts: {
        notices: 6,
        answers: 25,
        confirmedNotices: 4,
        thanksReceived: 41,
        viewsReceived: 312,
      },
      week: { notices: 2, views: 80, thanks: 9 },
      today: [{ ...NOTICE, state: 'ended', mine: true, views: 37, thanks: 12 }],
    },
  });
  const summary = await server.you();
  expect(summary.counts.answers).toBe(25);
  expect(summary.today[0].state).toBe('ended');

  client.get.mockResolvedValueOnce({
    data: {
      week: {
        from: '2026-11-23',
        notices: 1240,
        answers: 4860,
        views: 9300,
        minutesToEnd: 38.5,
      },
      month: {
        month: '2026-10',
        weekdays: 22,
        notices: 980,
        problems: [
          {
            kind: 'internet',
            status: 'wifi_down',
            block: 'A',
            gate: null,
            days: 6,
            notices: 14,
            minutesToEnd: null,
            peakHours: [9, 14],
          },
        ],
      },
    },
  });
  const community = await server.community('2026-10');
  expect(client.get).toHaveBeenLastCalledWith(
    '/v2/campus-now/community?month=2026-10',
    undefined,
  );
  expect(community.week.minutesToEnd).toBe(38.5);
  expect(community.month.problems[0]).toMatchObject({
    block: 'A',
    peakHours: [9, 14],
  });
});

it('turns the documented refusals into CampusNowError and the rest into AppError', async () => {
  const { client, server } = setup();
  const cases: [number, string, unknown][] = [
    [404, 'notice_not_found', new CampusNowError('gone')],
    [403, 'own_notice', new CampusNowError('own')],
    [409, 'already_answered', new CampusNowError('answered')],
    [422, 'invalid_place', new CampusNowError('place')],
    [429, 'notice_limit_reached', new CampusNowError('limit')],
    [503, 'campus_full', new CampusNowError('full')],
    [429, 'rate_limited', new AppError('RATE_LIMITED')],
    [400, 'invalid_request', new AppError('INVALID_INPUT')],
    [500, 'internal_server_error', new AppError('SERVICE_UNAVAILABLE')],
  ];
  for (const [status, code, expected] of cases) {
    client.post.mockRejectedValueOnce(rejected(status, code));
    await expect(server.answer('n1', 'confirm')).rejects.toEqual(expected);
  }
  client.get.mockRejectedValueOnce(new AxiosError('offline', 'ERR_NETWORK'));
  await expect(server.list()).rejects.toEqual(new AppError('NETWORK'));
});
