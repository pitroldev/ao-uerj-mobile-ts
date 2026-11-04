import { AxiosError, AxiosHeaders } from 'axios';
import { AppError } from '@root/shared/errors/AppError';
import type { PrivateApiHttpClient } from '../index';
import { createSessionClient } from '../sessionClient';

/** Um erro do axios com a resposta do servidor. */
function answered(status: number, data: unknown) {
  return new AxiosError('refused', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data,
  });
}

function setup() {
  const http: jest.Mocked<PrivateApiHttpClient> = {
    get: jest.fn(),
    post: jest.fn(),
  };
  let token = 'first';
  const session = {
    token: jest.fn(async () => token),
    invalidate: jest.fn(async () => {
      token = 'second';
    }),
    banned: jest.fn(() => new AppError('STUDENT_BANNED', 'suspensa')),
  };
  return { http, session, client: createSessionClient(http, session) };
}

it('sends the session in every request, keeping the other headers', async () => {
  const { http, client } = setup();
  http.post.mockResolvedValue({ data: 'ok' });
  await client.post(
    '/v2/reports',
    { page: 'x' },
    { headers: { 'X-Member-Key': 'k' } },
  );
  expect(http.post).toHaveBeenCalledWith(
    '/v2/reports',
    { page: 'x' },
    { headers: { 'X-Member-Key': 'k', Authorization: 'Student first' } },
  );
});

it('signs in again once when the server no longer knows the session', async () => {
  const { http, session, client } = setup();
  http.get
    .mockRejectedValueOnce(answered(401, { error: 'invalid_session' }))
    .mockResolvedValueOnce({ data: 'ok' });
  await expect(client.get('/v2/teachers')).resolves.toEqual({ data: 'ok' });
  expect(session.invalidate).toHaveBeenCalledWith('first');
  expect(http.get).toHaveBeenLastCalledWith('/v2/teachers', {
    headers: { Authorization: 'Student second' },
  });

  // duas recusas seguidas: o erro sobe
  http.get.mockRejectedValue(answered(401, { error: 'invalid_session' }));
  await expect(client.get('/v2/teachers')).rejects.toBeInstanceOf(AxiosError);
});

it('turns the ban into STUDENT_BANNED, with the date the server sent', async () => {
  const { http, session, client } = setup();
  http.get.mockRejectedValue(
    answered(403, {
      error: 'student_banned',
      message: 'banned',
      until: '2026-12-10T17:00:00.000Z',
      reason: 'Assédio',
    }),
  );
  await expect(client.get('/v2/teachers')).rejects.toEqual(
    new AppError('STUDENT_BANNED', 'suspensa'),
  );
  expect(session.banned).toHaveBeenCalledWith({
    until: Date.parse('2026-12-10T17:00:00.000Z'),
    reason: 'Assédio',
  });
  expect(session.invalidate).not.toHaveBeenCalled();
});

it('lets the other errors through untouched', async () => {
  const { http, client } = setup();
  const error = answered(409, { error: 'already_member' });
  http.post.mockRejectedValue(error);
  await expect(client.post('/v2/companion/calls/x/members', {})).rejects.toBe(
    error,
  );
});
