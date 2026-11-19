import { AxiosError, type AxiosResponse } from 'axios';
import { AppError } from '@root/shared/errors/AppError';
import type { PrivateApiHttpClient } from '../index';
import {
  createPortalPushServer,
  createPortalReturnServer,
} from '../portalPush';

const TOKEN = 'ab'.repeat(32);

const rejected = (status: number, error?: string) =>
  new AxiosError('request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: '',
    data: error ? { error, message: '' } : {},
    headers: {},
    config: {},
  } as AxiosResponse);

function client() {
  const student: jest.Mocked<PrivateApiHttpClient> = {
    get: jest.fn(),
    post: jest.fn(),
  };
  return student;
}

it('asks the server for the "Avisar quando voltar" by push, with the student session', async () => {
  const student = client();
  const server = createPortalReturnServer(student);
  student.get.mockResolvedValueOnce({
    data: { available: true, requested: false },
  });
  await expect(server.status()).resolves.toEqual({
    available: true,
    requested: false,
  });
  expect(student.get).toHaveBeenCalledWith('/v2/portal/return-alert');

  student.post.mockResolvedValue({ data: '' });
  await server.request(TOKEN);
  expect(student.post).toHaveBeenCalledWith('/v2/portal/return-alert', {
    platform: 'ios',
    token: TOKEN,
  });
  await server.cancel();
  expect(student.post).toHaveBeenLastCalledWith(
    '/v2/portal/return-alert/cancel',
    {},
  );
});

it('registers the iPhone for the nudge of the portal check', async () => {
  const student = client();
  const server = createPortalPushServer(student);
  student.get.mockResolvedValueOnce({
    data: { available: false, registered: false },
  });
  await expect(server.status()).resolves.toEqual({
    available: false,
    registered: false,
  });
  expect(student.get).toHaveBeenCalledWith('/v2/portal/push');

  student.post.mockResolvedValue({ data: '' });
  await server.register(TOKEN);
  expect(student.post).toHaveBeenCalledWith('/v2/portal/push', {
    platform: 'ios',
    token: TOKEN,
  });
  await server.unregister();
  expect(student.post).toHaveBeenLastCalledWith('/v2/portal/push/cancel', {});
});

it('turns the refusal, the network and a broken answer into app errors', async () => {
  const student = client();
  const server = createPortalPushServer(student);
  student.post.mockRejectedValueOnce(rejected(503, 'push_unavailable'));
  await expect(server.register(TOKEN)).rejects.toEqual(
    new AppError('SERVICE_UNAVAILABLE'),
  );
  student.post.mockRejectedValueOnce(new AxiosError('offline', 'ERR_NETWORK'));
  await expect(server.register(TOKEN)).rejects.toEqual(new AppError('NETWORK'));
  student.get.mockResolvedValueOnce({ data: { available: 'yes' } });
  await expect(createPortalReturnServer(student).status()).rejects.toEqual(
    new AppError('SERVICE_UNAVAILABLE'),
  );
});
