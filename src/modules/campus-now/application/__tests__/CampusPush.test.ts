import { AppError } from '@root/shared/errors/AppError';
import { CAMPUS_PUSH_KEY, CampusPush, DEVICE_SCOPE } from '../CampusPush';

const TOKEN = 'ab'.repeat(32);

function setup({
  token = TOKEN,
  available = true,
}: { token?: string | null; available?: boolean } = {}) {
  const saved = new Map<string, unknown>();
  const server = {
    status: jest.fn(async () => ({ available, registered: false })),
    register: jest.fn(async (_token: string) => undefined),
    unregister: jest.fn(async () => undefined),
  };
  const push = new CampusPush({
    server,
    token: async () => token,
    store: {
      read: async <T>(scope: string, key: string) =>
        (saved.get(`${scope}/${key}`) as T) ?? null,
      write: async (scope: string, key: string, value: unknown) => {
        saved.set(`${scope}/${key}`, value);
      },
    },
  });
  return { push, server, saved };
}

it('says whether the server sends push', async () => {
  await expect(setup().push.available()).resolves.toBe(true);
  await expect(setup({ available: false }).push.available()).resolves.toBe(
    false,
  );
});

it('registers the push token and remembers that this device did', async () => {
  const { push, server, saved } = setup();
  await push.apply(true);
  expect(server.register).toHaveBeenCalledWith(TOKEN);
  expect(saved.get(`${DEVICE_SCOPE}/${CAMPUS_PUSH_KEY}`)).toBe(true);

  await push.apply(false);
  expect(server.unregister).toHaveBeenCalledTimes(1);
  expect(saved.get(`${DEVICE_SCOPE}/${CAMPUS_PUSH_KEY}`)).toBeNull();
});

it('makes no request to turn off a device that never registered', async () => {
  const { push, server } = setup();
  await push.apply(false);
  await push.signOut();
  expect(server.unregister).not.toHaveBeenCalled();
});

it('fails without the token, so the next opening tries again', async () => {
  const { push, server } = setup({ token: null });
  await expect(push.apply(true)).rejects.toThrow(
    'Sem o token de push do aparelho',
  );
  expect(server.register).not.toHaveBeenCalled();
});

it('leaves the server on sign out, and a failure there does not stop the sign out', async () => {
  const { push, server } = setup();
  await push.apply(true);
  server.unregister.mockRejectedValueOnce(new AppError('NETWORK'));
  await expect(push.signOut()).resolves.toBeUndefined();
  // a próxima tentativa ainda sabe que este aparelho está registrado
  await push.signOut();
  expect(server.unregister).toHaveBeenCalledTimes(2);
});
