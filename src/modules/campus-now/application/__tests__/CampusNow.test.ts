import type { CampusNowServerPort, CampusNowStorePort } from '../ports';
import type {
  CampusNotice,
  NoticeList,
  NoticeRequest,
} from '../../domain/campusNow';
import { CampusNow } from '../CampusNow';
import { CAMPUS_STATE_KEY, dayKey, normalizeCampusState } from '../campusState';

const NOW = new Date(2026, 10, 23, 14, 0).getTime();

function notice(partial: Partial<CampusNotice> = {}): CampusNotice {
  return {
    id: 'n1',
    kind: 'power',
    status: 'no_ac',
    place: { type: 'floor', block: 'B', floor: '6' },
    createdAt: NOW,
    expiresAt: NOW + 2 * 3600_000,
    state: 'active',
    confirmations: 0,
    ends: 0,
    confirmed: false,
    level: null,
    mine: true,
    answer: null,
    thanked: false,
    flagged: false,
    views: 0,
    thanks: 0,
    ...partial,
  };
}

const you = { points: 300, level: 3, levelAt: 300, nextLevelAt: 800 };

function setup({
  account = { scope: 'conta' },
}: { account?: { scope: string } | null } = {}) {
  const saved = new Map<string, unknown>();
  const server: jest.Mocked<CampusNowServerPort> = {
    list: jest.fn(),
    report: jest.fn(async (_request: NoticeRequest) => ({
      notice: notice(),
      merged: false,
      replaced: null,
      you: { ...you, earned: 10 },
    })),
    answer: jest.fn(),
    thank: jest.fn(),
    flag: jest.fn(async (_id: string) => undefined),
    seen: jest.fn(async (_ids: readonly string[]) => undefined),
    you: jest.fn(),
    community: jest.fn(),
  };
  const write = jest.fn(async (owner: string, key: string, value: unknown) => {
    saved.set(`${owner}/${key}`, value);
  });
  const store = {
    read: (async (owner: string, key: string) =>
      saved.get(`${owner}/${key}`) ?? null) as CampusNowStorePort['read'],
    write: write as CampusNowStorePort['write'],
  };
  const campus = new CampusNow({
    server,
    store,
    account: () => account,
    now: () => NOW,
  });
  const state = () =>
    normalizeCampusState(saved.get(`conta/${CAMPUS_STATE_KEY}`), NOW);
  return { campus, server, store, write, state, saved };
}

it('is not supported without the student session', () => {
  const campus = new CampusNow({
    server: null,
    store: { read: async () => null, write: async () => undefined },
    account: () => ({ scope: 'conta' }),
    now: () => NOW,
  });
  expect(campus.supported).toBe(false);
  expect(() => campus.list()).toThrow('Agora no campus indisponível');
});

it('remembers the notice the student sent today, for the phone notices', async () => {
  const { campus, state } = setup();
  await campus.report({
    kind: 'power',
    status: 'no_ac',
    place: { type: 'floor', block: 'B', floor: '6' },
  });
  expect(state().own).toEqual([
    {
      id: 'n1',
      kind: 'power',
      status: 'no_ac',
      createdAt: NOW,
      thanks: 0,
      views: 0,
      confirmedTold: false,
      done: false,
    },
  ]);
});

it('does not remember a report that became the confirmation of an existing notice', async () => {
  const { campus, server, state } = setup();
  server.report.mockResolvedValueOnce({
    notice: notice({ mine: false }),
    merged: true,
    replaced: null,
    you: { ...you, earned: 3 },
  });
  await campus.report({
    kind: 'power',
    status: 'no_ac',
    place: { type: 'floor', block: 'B', floor: '6' },
  });
  expect(state().own).toEqual([]);
});

it('counts each notice seen once per run and gives the ids back when sending fails', async () => {
  const { campus, server } = setup();
  await campus.markSeen(['a', 'b', 'a']);
  await campus.markSeen(['a', 'b']);
  expect(server.seen).toHaveBeenCalledTimes(1);
  expect(server.seen).toHaveBeenCalledWith(['a', 'b']);
  server.seen.mockRejectedValueOnce(new Error('offline'));
  await campus.markSeen(['c']);
  await campus.markSeen(['c']);
  expect(server.seen).toHaveBeenLastCalledWith(['c']);
  expect(server.seen).toHaveBeenCalledTimes(3);
});

it('skips a notice for the day, marks the first visit and keeps the rooms only when they change', async () => {
  const { campus, write, state } = setup();
  await campus.load();
  expect(campus.getSnapshot()).toEqual({
    scope: 'conta',
    skipped: [],
    visited: false,
    asked: [],
  });
  const listener = jest.fn();
  campus.subscribe(listener);
  await campus.skip('n9');
  await campus.skip('n9');
  await campus.visit();
  expect(campus.getSnapshot()).toEqual({
    scope: 'conta',
    skipped: ['n9'],
    visited: true,
    asked: [],
  });
  expect(listener).toHaveBeenCalledTimes(2);
  const rooms = [
    {
      weekday: 1,
      start: 860,
      end: 960,
      room: '6019',
      block: 'B' as const,
      floor: '6',
    },
  ];
  await campus.rememberClasses(rooms);
  const writes = write.mock.calls.length;
  await campus.rememberClasses(rooms);
  expect(write.mock.calls.length).toBe(writes);
  expect(state().classes).toEqual(rooms);
  expect(state().day).toBe(dayKey(NOW));
});

it('what the screen showed does not become a phone notice later', async () => {
  const { campus, state } = setup();
  await campus.report({
    kind: 'power',
    status: 'no_ac',
    place: { type: 'floor', block: 'B', floor: '6' },
  });
  const list: NoticeList = {
    notices: [
      notice({ confirmed: true, confirmations: 1, views: 4, thanks: 1 }),
    ],
    helpersToday: 3,
    you,
  };
  await campus.observe(list);
  expect(state().own[0]).toMatchObject({
    confirmedTold: true,
    views: 4,
    thanks: 1,
  });
  expect(state().level).toBe(3);
});

it('marks the first visit of each account, even after another one visited', async () => {
  let owner = { scope: 'conta' };
  const saved = new Map<string, unknown>();
  const campus = new CampusNow({
    server: null,
    store: {
      read: (async (scope: string, key: string) =>
        saved.get(`${scope}/${key}`) ?? null) as CampusNowStorePort['read'],
      write: async (scope: string, key: string, value: unknown) => {
        saved.set(`${scope}/${key}`, value);
      },
    },
    account: () => owner,
    now: () => NOW,
  });
  await campus.visit();
  expect(campus.getSnapshot()).toMatchObject({ scope: 'conta', visited: true });
  // logout (a preferência some) e outra conta entra
  owner = { scope: 'outra' };
  await campus.visit();
  expect(campus.getSnapshot()).toMatchObject({ scope: 'outra', visited: true });
  expect(
    normalizeCampusState(saved.get(`outra/${CAMPUS_STATE_KEY}`), NOW).visited,
  ).toBe(true);
});

it('does nothing without an account', async () => {
  const { campus, server, write } = setup({ account: null });
  await campus.markSeen(['a']);
  await campus.skip('a');
  expect(server.seen).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
});

it('starts the lists over on a new day, keeping the rooms, the visit and the level', () => {
  const yesterday = normalizeCampusState(
    {
      day: '2026-11-22',
      visited: true,
      classes: [
        {
          weekday: 1,
          start: 860,
          end: 960,
          room: '6019',
          block: 'B',
          floor: '6',
        },
      ],
      skipped: ['a'],
      asked: ['b'],
      own: [{ id: 'c', kind: 'ru', status: 'closed', createdAt: NOW }],
      level: 2,
    },
    NOW,
  );
  expect(yesterday).toMatchObject({
    day: '2026-11-23',
    visited: true,
    skipped: [],
    asked: [],
    own: [],
    level: 2,
  });
  expect(yesterday.classes).toHaveLength(1);
  // um formato estragado vira o vazio
  expect(normalizeCampusState('lixo', NOW)).toMatchObject({
    visited: false,
    classes: [],
    level: null,
  });
});
