import { AxiosError, type AxiosResponse } from 'axios';
import { AppError } from '@root/shared/errors/AppError';
import type { PrivateApiHttpClient } from '../index';
import { createStudentClient } from '../studentClient';

const rejected = (status: number) =>
  new AxiosError('request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: '',
    data: {},
    headers: {},
    config: {},
  } as AxiosResponse);

function setup(available: string[]) {
  const client: jest.Mocked<PrivateApiHttpClient> = {
    get: jest.fn(),
    post: jest.fn(),
  };
  const tokens = { take: jest.fn(async () => available.shift() ?? null) };
  return { client, tokens, student: createStudentClient(client, tokens) };
}

it('spends one token per request, keeping the other options', async () => {
  const { client, student } = setup([
    'PrivateToken token="a"',
    'PrivateToken token="b"',
  ]);
  const signal = new AbortController().signal;
  client.get.mockResolvedValueOnce({ data: { authenticated: true } });
  client.post.mockResolvedValueOnce({ data: 'ok' });

  await expect(student.get('/v2/auth', { signal })).resolves.toEqual({
    data: { authenticated: true },
  });
  await student.post('/v2/x', { a: 1 }, { headers: { 'X-Outro': '1' } });
  expect(client.get).toHaveBeenCalledWith('/v2/auth', {
    signal,
    headers: { Authorization: 'PrivateToken token="a"' },
  });
  expect(client.post).toHaveBeenCalledWith(
    '/v2/x',
    { a: 1 },
    { headers: { 'X-Outro': '1', Authorization: 'PrivateToken token="b"' } },
  );
});

it('swaps the token once after a 401', async () => {
  const { client, student, tokens } = setup(['gasto', 'novo', 'outro']);
  client.get
    .mockRejectedValueOnce(rejected(401))
    .mockResolvedValueOnce({ data: 'ok' });
  await expect(student.get('/v2/auth')).resolves.toEqual({ data: 'ok' });
  expect(client.get).toHaveBeenLastCalledWith('/v2/auth', {
    headers: { Authorization: 'novo' },
  });
  expect(tokens.take).toHaveBeenCalledTimes(2);

  client.get.mockRejectedValue(rejected(401));
  await expect(student.get('/v2/auth')).rejects.toEqual(
    new AppError('STUDENT_PROOF_UNAVAILABLE'),
  );
});

it('cannot prove the student without tokens, and passes other errors on', async () => {
  const empty = setup([]);
  await expect(empty.student.get('/v2/auth')).rejects.toEqual(
    new AppError('STUDENT_PROOF_UNAVAILABLE'),
  );
  expect(empty.client.get).not.toHaveBeenCalled();

  const { client, student, tokens } = setup(['a', 'b']);
  const unavailable = rejected(503);
  client.get.mockRejectedValueOnce(unavailable);
  await expect(student.get('/v2/auth')).rejects.toBe(unavailable);
  expect(tokens.take).toHaveBeenCalledTimes(1);
});
