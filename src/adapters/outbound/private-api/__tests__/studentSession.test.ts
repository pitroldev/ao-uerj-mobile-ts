import { AxiosError, AxiosHeaders } from 'axios';
import { AppError } from '@root/shared/errors/AppError';
import type { PrivateApiHttpClient } from '../index';
import { createStudentSessionApi } from '../studentSession';

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
  return { http, api: createStudentSessionApi(http) };
}

const request = {
  challenge: Uint8Array.of(1, 2, 3),
  installation: Uint8Array.of(250, 251),
  integrityToken: 'play',
  matricula: '201810012345',
  name: 'MARINA COSTA',
};

it('reads the challenge, and a server without sign-in as null', async () => {
  const { http, api } = setup();
  http.get.mockResolvedValueOnce({
    data: { challenge: 'AQID', expiresAt: 'x' },
  });
  await expect(api.challenge()).resolves.toEqual(Uint8Array.of(1, 2, 3));
  expect(http.get).toHaveBeenCalledWith('/v2/students/challenge');
  http.get.mockRejectedValueOnce(
    answered(503, { error: 'student_identity_unavailable' }),
  );
  await expect(api.challenge()).resolves.toBeNull();
  http.get.mockRejectedValueOnce(new AxiosError('offline'));
  await expect(api.challenge()).rejects.toEqual(new AppError('NETWORK'));
});

it('sends the sign-in in base64url and reads the session', async () => {
  const { http, api } = setup();
  http.post.mockResolvedValueOnce({
    data: {
      session: 's'.repeat(43),
      expiresAt: '2026-12-03T12:00:00.000Z',
      student: { id: 'abc' },
    },
  });
  await expect(api.create(request)).resolves.toEqual({
    created: true,
    token: 's'.repeat(43),
    expiresAt: Date.parse('2026-12-03T12:00:00.000Z'),
  });
  expect(http.post).toHaveBeenCalledWith('/v2/students/session', {
    challenge: 'AQID',
    installation: '-vs=',
    integrityToken: 'play',
    matricula: '201810012345',
    name: 'MARINA COSTA',
  });
});

it('tells the refusals apart: challenge, attestation, ban and the server off', async () => {
  const { http, api } = setup();
  http.post.mockRejectedValueOnce(
    answered(403, { error: 'invalid_challenge' }),
  );
  await expect(api.create(request)).resolves.toEqual({
    created: false,
    refusal: 'invalid_challenge',
  });
  http.post.mockRejectedValueOnce(
    answered(403, { error: 'attestation_failed' }),
  );
  await expect(api.create(request)).resolves.toEqual({
    created: false,
    refusal: 'attestation_failed',
  });
  http.post.mockRejectedValueOnce(
    answered(403, { error: 'student_banned', until: null, reason: 'Spam' }),
  );
  await expect(api.create(request)).resolves.toEqual({
    created: false,
    refusal: 'banned',
    ban: { until: null, reason: 'Spam' },
  });
  http.post.mockRejectedValueOnce(answered(503, { error: 'x' }));
  await expect(api.create(request)).resolves.toEqual({
    created: false,
    refusal: 'unavailable',
  });
  http.post.mockRejectedValueOnce(answered(500, {}));
  await expect(api.create(request)).rejects.toEqual(
    new AppError('SERVICE_UNAVAILABLE'),
  );
  // o limite por IP: o app espera um pouco antes de tentar de novo
  http.post.mockRejectedValueOnce(answered(429, { error: 'rate_limited' }));
  await expect(api.create(request)).rejects.toEqual(
    new AppError('RATE_LIMITED'),
  );
});

it('ends the session with it in the header, without failing the logout', async () => {
  const { http, api } = setup();
  http.post.mockRejectedValueOnce(new AxiosError('offline'));
  await expect(api.end('tok')).resolves.toBeUndefined();
  expect(http.post).toHaveBeenCalledWith(
    '/v2/students/session/end',
    {},
    { headers: { Authorization: 'Student tok' } },
  );
});
