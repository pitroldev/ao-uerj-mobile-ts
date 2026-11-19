import {
  APP_STORE_LOOKUP_URL,
  createAppStoreUpdates,
} from '../appStoreUpdates';

const NOW = Date.parse('2026-11-25T12:00:00Z');

/** A resposta da ficha pública da App Store, como a Apple manda. */
const lookup = (app: Record<string, unknown> | null, ok = true) =>
  jest.fn<Promise<Response>, Parameters<typeof fetch>>(
    async () =>
      ({
        ok,
        json: async () => ({
          resultCount: app ? 1 : 0,
          results: app ? [app] : [],
        }),
      }) as Response,
  );

const app = (version: string, released = '2026-11-20T08:00:00Z') => ({
  trackId: 6835308883,
  bundleId: 'com.aouerjmobile',
  version,
  currentVersionReleaseDate: released,
});

it('asks the public App Store record of the app, and nothing about the student', async () => {
  const fetch = lookup(app('2.19.0'));
  await createAppStoreUpdates({
    appVersion: '2.18.0',
    fetch,
    now: () => NOW,
  }).check();
  expect(APP_STORE_LOOKUP_URL).toBe(
    'https://itunes.apple.com/lookup?id=6835308883&country=br',
  );
  expect(fetch).toHaveBeenCalledWith(APP_STORE_LOOKUP_URL, {
    signal: expect.any(AbortSignal),
    headers: { Accept: 'application/json' },
  });
});

it('offers a newer version, with the days since it came out', async () => {
  const updates = createAppStoreUpdates({
    appVersion: '2.18.0',
    fetch: lookup(app('2.19.0')),
    now: () => NOW,
  });
  expect(updates.inApp).toBe(false);
  await expect(updates.check()).resolves.toMatchObject({
    availability: 'available',
    version: '2.19.0',
    versionCode: 20190000,
    stalenessDays: 5,
    installStatus: 'unknown',
  });
});

it.each([
  ['the same version', '2.19.0'],
  ['an older one (the review is still running)', '2.17.2'],
])(
  'says there is nothing to install when the store has %s',
  async (_label, version) => {
    const updates = createAppStoreUpdates({
      appVersion: '2.19.0',
      fetch: lookup(app(version)),
      now: () => NOW,
    });
    await expect(updates.check()).resolves.toMatchObject({
      availability: 'none',
      version,
    });
  },
);

const offline = jest.fn<Promise<Response>, Parameters<typeof fetch>>(async () =>
  Promise.reject(new Error('offline')),
);

it.each([
  ['no network', offline],
  ['an error page', lookup(app('2.19.0'), false)],
  ['no app in the answer', lookup(null)],
  ['another app', lookup({ ...app('9.0.0'), bundleId: 'com.outro' })],
  ['a version out of format', lookup(app('2.19'))],
])('knows nothing with %s', async (_label, fetch) => {
  const updates = createAppStoreUpdates({
    appVersion: '2.18.0',
    fetch,
    now: () => NOW,
  });
  await expect(updates.check()).resolves.toBeNull();
});

it('keeps the answer for some hours, and asks again after them', async () => {
  let now = NOW;
  const fetch = lookup(app('2.19.0'));
  const updates = createAppStoreUpdates({
    appVersion: '2.18.0',
    fetch,
    now: () => now,
  });
  await updates.check();
  now += 60 * 60 * 1000;
  await updates.check();
  expect(fetch).toHaveBeenCalledTimes(1);
  now += 6 * 60 * 60 * 1000;
  await updates.check();
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('has no flow inside the app: updating is opening the store page', async () => {
  const updates = createAppStoreUpdates({
    appVersion: '2.18.0',
    fetch: lookup(app('2.19.0')),
  });
  await expect(updates.start('immediate')).resolves.toBe('notAllowed');
  await expect(updates.complete()).rejects.toThrow('não instala dentro do app');
  expect(updates.onInstallProgress(jest.fn())).toEqual(expect.any(Function));
});
