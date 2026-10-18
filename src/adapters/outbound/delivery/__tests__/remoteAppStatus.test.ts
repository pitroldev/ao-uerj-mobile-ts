import { AppError } from '@root/shared/errors/AppError';
import {
  APP_STATUS_URL,
  createRemoteAppStatusSource,
  MAX_APP_STATUS_LENGTH,
} from '../remoteAppStatus';
import { APP_SCOPE, createAppKeyValueStore } from '../appStore';

type Init = { signal: AbortSignal; headers: Record<string, string> };

/** Resposta com o corpo em texto (objetos viram JSON). */
const respond = (
  body: unknown,
  { ok = true, length }: { ok?: boolean; length?: number } = {},
) =>
  jest.fn(async (_url: string, _init: Init) => ({
    ok,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-length' && length !== undefined
          ? String(length)
          : null,
    },
    text: jest.fn(async () =>
      typeof body === 'string' ? body : JSON.stringify(body),
    ),
  }));

it('fetches the public JSON from the main branch without cache', async () => {
  const fetchImpl = respond({ schemaVersion: 1 });
  const source = createRemoteAppStatusSource({ fetchImpl });
  await expect(source.fetch()).resolves.toEqual({ schemaVersion: 1 });
  expect(APP_STATUS_URL).toBe(
    'https://raw.githubusercontent.com/pitroldev/ao-uerj-mobile-ts/main/config/app-status.json',
  );
  expect(fetchImpl).toHaveBeenCalledWith(APP_STATUS_URL, {
    signal: expect.any(AbortSignal),
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
  });
});

it('rejects HTTP errors and invalid JSON', async () => {
  await expect(
    createRemoteAppStatusSource({
      fetchImpl: respond({}, { ok: false }),
    }).fetch(),
  ).rejects.toEqual(new AppError('SERVICE_UNAVAILABLE'));
  await expect(
    createRemoteAppStatusSource({
      fetchImpl: respond('<html>Not Found</html>'),
    }).fetch(),
  ).rejects.toEqual(new AppError('NETWORK'));
});

it('refuses a body far larger than the notice file', async () => {
  // tamanho declarado: nem baixa o corpo
  const declared = respond({}, { length: MAX_APP_STATUS_LENGTH + 1 });
  await expect(
    createRemoteAppStatusSource({ fetchImpl: declared }).fetch(),
  ).rejects.toEqual(new AppError('SERVICE_UNAVAILABLE'));
  const response = await declared.mock.results[0].value;
  expect(response.text).not.toHaveBeenCalled();

  // sem o tamanho (resposta compactada): confere o texto
  const huge = JSON.stringify({ notices: 'x'.repeat(MAX_APP_STATUS_LENGTH) });
  await expect(
    createRemoteAppStatusSource({ fetchImpl: respond(huge) }).fetch(),
  ).rejects.toEqual(new AppError('SERVICE_UNAVAILABLE'));

  await expect(
    createRemoteAppStatusSource({
      fetchImpl: respond({ schemaVersion: 1 }, { length: 20 }),
    }).fetch(),
  ).resolves.toEqual({ schemaVersion: 1 });
});

it('gives up after the timeout', async () => {
  jest.useFakeTimers();
  try {
    const fetchImpl = jest.fn(
      (_url: string, { signal }: Init) =>
        new Promise<never>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const pending = createRemoteAppStatusSource({
      fetchImpl,
      timeoutMs: 8000,
    }).fetch();
    jest.advanceTimersByTime(8000);
    await expect(pending).rejects.toEqual(new AppError('NETWORK'));
  } finally {
    jest.useRealTimers();
  }
});

it('keeps app-wide values in their own preferences scope', async () => {
  const preferences = {
    read: jest.fn(async (): Promise<any> => 'valor'),
    write: jest.fn(async () => undefined),
    update: jest.fn(async (): Promise<any> => undefined),
    remove: jest.fn(async () => undefined),
  };
  const store = createAppKeyValueStore(preferences);
  await expect(store.read('app-status')).resolves.toBe('valor');
  await store.write('review-history', { sessions: 1 });
  expect(preferences.read).toHaveBeenCalledWith(APP_SCOPE, 'app-status');
  expect(preferences.write).toHaveBeenCalledWith(APP_SCOPE, 'review-history', {
    sessions: 1,
  });
  expect(APP_SCOPE).not.toMatch(/^account-/);
});
