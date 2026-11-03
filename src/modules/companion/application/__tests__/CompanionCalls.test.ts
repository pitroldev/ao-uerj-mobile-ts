import {
  CompanionError,
  type MemberCall,
  type Membership,
} from '../../domain/companion';
import { CompanionCalls } from '../CompanionCalls';
import type { CompanionServerPort, MembershipStorePort } from '../ports';

const MINUTE = 60_000;
const NOW = Date.UTC(2026, 10, 23, 15, 5);

function memberCall(id: string, extra: Partial<MemberCall> = {}): MemberCall {
  return {
    id,
    kind: 'lunch',
    at: NOW + 20 * MINUTE,
    spot: 'ru',
    destination: null,
    note: '',
    host: 'Júlia',
    going: 1,
    capacity: 6,
    listedUntil: NOW + 50 * MINUTE,
    expiresAt: NOW + 50 * MINUTE,
    endedAt: null,
    members: [{ name: 'Júlia', host: true, you: true }],
    feed: [],
    ...extra,
  };
}

function setup(saved: Membership[] = []) {
  let now = NOW;
  const stored = { value: saved };
  const store: MembershipStorePort = {
    read: jest.fn(async () => stored.value),
    write: jest.fn(async memberships => {
      stored.value = [...memberships];
    }),
  };
  let passes = 0;
  const server = {
    pass: jest.fn(async () => ({
      pass: `pass-${++passes}`,
      expiresAt: now + 60 * MINUTE,
    })),
    list: jest.fn(async () => []),
    open: jest.fn(async () => ({
      call: memberCall('mine'),
      memberKey: 'k-mine',
    })),
    join: jest.fn(async (callId: string) => ({
      call: memberCall(callId, { host: 'Lucas', going: 2 }),
      memberKey: `k-${callId}`,
    })),
    read: jest.fn(async (callId: string) => memberCall(callId)),
    leave: jest.fn(async () => undefined),
    say: jest.fn(async (callId: string) => memberCall(callId)),
    report: jest.fn(async () => undefined),
  } satisfies CompanionServerPort;
  const calls = new CompanionCalls({ server, store, now: () => now });
  return {
    calls,
    server,
    store,
    stored,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

it('reads the list with one pass per hour and asks for another when it expires', async () => {
  const { calls, server, advance } = setup();
  await calls.list();
  await calls.list();
  expect(server.pass).toHaveBeenCalledTimes(1);
  expect(server.list).toHaveBeenLastCalledWith('pass-1', undefined);

  // um minuto antes de vencer, o passe é trocado
  advance(59 * MINUTE + 1);
  await calls.list();
  expect(server.pass).toHaveBeenCalledTimes(2);

  // o servidor recusou o passe (chave trocada): outro, uma vez
  server.list.mockRejectedValueOnce(new CompanionError('pass_expired'));
  await calls.list();
  expect(server.pass).toHaveBeenCalledTimes(3);
  expect(server.list).toHaveBeenLastCalledWith('pass-3', undefined);
});

it('keeps the member key of each call it opens or joins, in the vault', async () => {
  const { calls, stored } = setup();
  await calls.open({
    kind: 'lunch',
    at: NOW + 20 * MINUTE,
    spot: 'ru',
    destination: null,
    note: '',
    capacity: 6,
    name: 'Marina',
  });
  await calls.join('other', 'Marina');
  expect(
    stored.value.map(item => [item.callId, item.memberKey, item.host]),
  ).toEqual([
    ['mine', 'k-mine', true],
    ['other', 'k-other', false],
  ]);
  expect(calls.getSnapshot()).toHaveLength(2);
});

it('has one open call at a time: opening another ends the previous', async () => {
  const mine: Membership = {
    callId: 'old',
    memberKey: 'k-old',
    host: true,
    kind: 'lunch',
    at: NOW + 10 * MINUTE,
    spot: 'lago',
    destination: null,
    expiresAt: NOW + 40 * MINUTE,
  };
  const { calls, server, stored } = setup([mine]);
  await calls.open({
    kind: 'lunch',
    at: NOW + 20 * MINUTE,
    spot: 'ru',
    destination: null,
    note: '',
    capacity: 6,
    name: 'Marina',
  });
  expect(server.leave).toHaveBeenCalledWith('old', 'k-old');
  expect(stored.value.map(item => item.callId)).toEqual(['mine']);
});

it('forgets a call that is over and drops the ones that expired', async () => {
  const saved: Membership[] = [
    {
      callId: 'gone',
      memberKey: 'k-gone',
      host: false,
      kind: 'home',
      at: NOW - 30 * MINUTE,
      spot: 'concha',
      destination: 'metro',
      expiresAt: NOW + 90 * MINUTE,
    },
    {
      callId: 'expired',
      memberKey: 'k-expired',
      host: false,
      kind: 'lunch',
      at: NOW - 60 * MINUTE,
      spot: 'ru',
      destination: null,
      expiresAt: NOW - 30 * MINUTE,
    },
  ];
  const { calls, server, stored } = setup(saved);
  await calls.load();
  expect(calls.getSnapshot().map(item => item.callId)).toEqual(['gone']);
  expect(stored.value.map(item => item.callId)).toEqual(['gone']);

  server.read.mockRejectedValueOnce(new CompanionError('gone'));
  await expect(calls.read('gone')).rejects.toThrow(CompanionError);
  expect(calls.getSnapshot()).toEqual([]);
  await expect(calls.read('gone')).rejects.toMatchObject({
    refusal: 'not_member',
  });
});

it('leaves even when the call already ended, and the logout leaves every call', async () => {
  const { calls, server, stored } = setup();
  await calls.join('a', 'Marina');
  await calls.join('b', 'Marina');
  server.leave.mockRejectedValueOnce(new CompanionError('gone'));
  await calls.leave('a');
  expect(stored.value.map(item => item.callId)).toEqual(['b']);

  // uma falha de rede não segura o logout
  server.leave.mockRejectedValueOnce(new Error('network'));
  await calls.clear();
  expect(server.leave).toHaveBeenLastCalledWith('b', 'k-b');
  expect(stored.value).toEqual([]);
  expect(calls.getSnapshot()).toEqual([]);
});

it('reports from inside with the member key and from outside with a token', async () => {
  const { calls, server } = setup();
  await calls.report('stranger', 'spam');
  expect(server.report).toHaveBeenLastCalledWith('stranger', 'spam', null);
  await calls.join('inside', 'Marina');
  await calls.report('inside', 'harassment');
  expect(server.report).toHaveBeenLastCalledWith(
    'inside',
    'harassment',
    'k-inside',
  );
});

it('tells the listeners when the memberships change', async () => {
  const { calls } = setup();
  const listener = jest.fn();
  calls.subscribe(listener);
  await calls.join('a', 'Marina');
  expect(listener).toHaveBeenCalled();
  listener.mockClear();
  await calls.forget('a');
  expect(listener).toHaveBeenCalledTimes(1);
});
