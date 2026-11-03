import { AxiosError, type AxiosResponse } from 'axios';
import { CompanionError } from '@root/modules/companion/domain/companion';
import { AppError } from '@root/shared/errors/AppError';
import { createCompanionServer } from '../companion';
import type { PrivateApiHttpClient } from '../index';

const rejected = (status: number, error?: string) =>
  new AxiosError('request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: '',
    data: error ? { error, message: '' } : {},
    headers: {},
    config: {},
  } as AxiosResponse);

const CALL = {
  id: 'abc',
  kind: 'home',
  at: '2026-11-24T01:15:00.000Z',
  spot: 'concha',
  destination: 'metro',
  note: 'A pé pelo Portão 1.',
  host: 'Renata',
  going: 3,
  capacity: 8,
  listedUntil: '2026-11-24T01:25:00.000Z',
  expiresAt: '2026-11-24T03:15:00.000Z',
};
const MEMBER = {
  ...CALL,
  endedAt: null,
  members: [
    { name: 'Renata', host: true, you: false },
    { name: 'Marina', host: false, you: true },
  ],
  feed: [
    {
      name: 'Renata',
      phrase: 'at_spot',
      at: '2026-11-24T01:08:00.000Z',
      you: false,
    },
  ],
};

function setup() {
  const client: jest.Mocked<PrivateApiHttpClient> = {
    get: jest.fn(),
    post: jest.fn(),
  };
  const student: jest.Mocked<PrivateApiHttpClient> = {
    get: jest.fn(),
    post: jest.fn(),
  };
  return { client, student, server: createCompanionServer(client, student) };
}

it('spends a token for the pass and reads the list with it', async () => {
  const { client, student, server } = setup();
  student.post.mockResolvedValueOnce({
    data: { pass: 'p'.repeat(48), expiresAt: '2026-11-24T02:00:00.000Z' },
  });
  client.get.mockResolvedValueOnce({ data: { calls: [CALL] } });

  const { pass, expiresAt } = await server.pass();
  expect(student.post).toHaveBeenCalledWith('/v2/companion/pass', {});
  expect(expiresAt).toBe(Date.parse('2026-11-24T02:00:00.000Z'));
  const [call] = await server.list(pass);
  expect(client.get).toHaveBeenCalledWith('/v2/companion/calls', {
    headers: { 'X-Student-Pass': pass },
  });
  expect(call).toEqual({
    ...CALL,
    at: Date.parse(CALL.at),
    listedUntil: Date.parse(CALL.listedUntil),
    expiresAt: Date.parse(CALL.expiresAt),
  });
});

it('opens and joins with a token, and the rest goes with the member key', async () => {
  const { client, student, server } = setup();
  student.post.mockResolvedValue({ data: { call: MEMBER, memberKey: 'key' } });
  client.post.mockResolvedValue({ data: { call: MEMBER } });
  client.get.mockResolvedValue({ data: { call: MEMBER } });

  await server.open({
    kind: 'home',
    at: Date.parse(CALL.at),
    spot: 'concha',
    destination: 'metro',
    note: 'A pé',
    capacity: 8,
    name: 'Marina',
  });
  expect(student.post).toHaveBeenLastCalledWith('/v2/companion/calls', {
    kind: 'home',
    at: CALL.at,
    spot: 'concha',
    destination: 'metro',
    note: 'A pé',
    capacity: 8,
    name: 'Marina',
  });
  const joined = await server.join('abc', 'Marina');
  expect(student.post).toHaveBeenLastCalledWith(
    '/v2/companion/calls/abc/members',
    { name: 'Marina' },
  );
  expect(joined.memberKey).toBe('key');
  expect(joined.call.feed[0]).toEqual({
    name: 'Renata',
    phrase: 'at_spot',
    at: Date.parse('2026-11-24T01:08:00.000Z'),
    you: false,
  });

  const headers = { headers: { 'X-Member-Key': 'key' } };
  await server.read('abc', 'key');
  expect(client.get).toHaveBeenLastCalledWith(
    '/v2/companion/calls/abc',
    headers,
  );
  await server.say('abc', 'key', 'home_safe');
  expect(client.post).toHaveBeenLastCalledWith(
    '/v2/companion/calls/abc/phrases',
    { phrase: 'home_safe' },
    headers,
  );
  await server.leave('abc', 'key');
  expect(client.post).toHaveBeenLastCalledWith(
    '/v2/companion/calls/abc/leave',
    {},
    headers,
  );
  await server.report('abc', 'spam', 'key');
  expect(client.post).toHaveBeenLastCalledWith(
    '/v2/companion/calls/abc/reports',
    { reason: 'spam' },
    headers,
  );
  // de fora, a denúncia gasta um token
  await server.report('abc', 'other', null);
  expect(student.post).toHaveBeenLastCalledWith(
    '/v2/companion/calls/abc/reports',
    { reason: 'other' },
  );
});

it('turns the refusals the server documents into reasons the screens explain', async () => {
  const { client, student, server } = setup();
  const cases: Array<[number, string, string]> = [
    [404, 'call_not_found', 'gone'],
    [409, 'call_full', 'full'],
    [409, 'call_closed', 'closed'],
    [409, 'call_ended', 'ended'],
    [422, 'note_not_allowed', 'contact'],
    [403, 'not_a_member', 'not_member'],
    [503, 'companion_full', 'busy'],
    [401, 'invalid_pass', 'pass_expired'],
  ];
  for (const [status, code, refusal] of cases) {
    student.post.mockRejectedValueOnce(rejected(status, code));
    await expect(server.join('abc', 'Marina')).rejects.toEqual(
      new CompanionError(refusal as never),
    );
  }
  client.get.mockRejectedValueOnce(rejected(429));
  await expect(server.read('abc', 'key')).rejects.toEqual(
    new AppError('RATE_LIMITED'),
  );
  client.get.mockRejectedValueOnce(new AxiosError('offline', 'ERR_NETWORK'));
  await expect(server.read('abc', 'key')).rejects.toEqual(
    new AppError('NETWORK'),
  );
  // o token que não provou o aluno passa como veio do cliente de aluno
  student.post.mockRejectedValueOnce(new AppError('STUDENT_PROOF_UNAVAILABLE'));
  await expect(server.pass()).rejects.toEqual(
    new AppError('STUDENT_PROOF_UNAVAILABLE'),
  );
});

it('refuses a response the app does not read', async () => {
  const { client, server } = setup();
  client.get.mockResolvedValueOnce({
    data: { calls: [{ ...CALL, spot: 'casa' }] },
  });
  await expect(server.list('pass')).rejects.toEqual(
    new AppError('SERVICE_UNAVAILABLE'),
  );
});
