import { AppError } from '@root/shared/errors/AppError';
import type { PermissionState } from '../ports';
import { PORTAL_RETURN_KEY, PortalReturnAlert } from '../PortalReturnAlert';
import { createDevice, createStore } from './fakes';

const ACCOUNT = { scope: 'account-a', period: '2026.2' };
const NOW = Date.UTC(2026, 9, 22, 17);
const DAY = 24 * 60 * 60 * 1000;

/** O servidor do "Avisar quando voltar" por push (iPhone). */
function createPushServer({
  token = 'ab'.repeat(32),
  available = true,
}: { token?: string | null; available?: boolean } = {}) {
  let requested = false;
  const server = {
    status: jest.fn(async () => ({ available, requested })),
    request: jest.fn(async (_token: string) => {
      if (!available) throw new AppError('SERVICE_UNAVAILABLE');
      requested = true;
    }),
    cancel: jest.fn(async () => {
      requested = false;
    }),
  };
  return {
    token,
    server,
    /** O servidor viu o portal de volta e mandou o push. */
    pushed: () => {
      requested = false;
    },
  };
}

function setup({
  request = 'granted',
  answers = true,
  disabled = false,
  account = ACCOUNT,
  now = NOW,
  push = null,
  locked = false,
}: {
  request?: PermissionState;
  answers?: boolean;
  disabled?: boolean;
  account?: typeof ACCOUNT | null;
  now?: number;
  push?: ReturnType<typeof createPushServer> | null;
  /** O Keychain fechado (a conta gravada antes, só desbloqueado). */
  locked?: boolean;
} = {}) {
  const device = createDevice({ request, permission: 'denied' });
  const store = createStore();
  const probe = jest.fn(async () => answers);
  const alert = new PortalReturnAlert({
    device,
    push: push && { token: async () => push.token, server: push.server },
    store,
    account: () => account,
    savedScope: async () => {
      if (locked) throw new Error('STORAGE_FAILED');
      return account?.scope ?? null;
    },
    remote: { disabled: () => disabled },
    probe,
    now: () => now,
  });
  return { alert, device, store, probe };
}

it('asks for permission, keeps the request and starts the watch', async () => {
  const { alert, device, store } = setup();
  await expect(alert.request()).resolves.toBe('requested');
  expect(device.requestPermission).toHaveBeenCalledTimes(1);
  expect(store.data.get(`account-a/${PORTAL_RETURN_KEY}`)).toEqual({
    requestedAt: NOW,
    via: 'device',
  });
  expect(device.state.returnWatch).toBe(true);
  expect(alert.getSnapshot()).toEqual({ scope: 'account-a', requested: true });
});

it('does not ask without permission', async () => {
  const { alert, device, store } = setup({ request: 'blocked' });
  await expect(alert.request()).resolves.toBe('denied');
  expect(store.data.size).toBe(0);
  expect(device.setPortalReturnWatch).not.toHaveBeenCalled();
});

it('notifies once in the background when the portal answers', async () => {
  const { alert, device, store, probe } = setup();
  await alert.request();
  await expect(alert.checkInBackground()).resolves.toBe('notified');
  expect(probe).toHaveBeenCalledTimes(1);
  expect(device.notify).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'portal:back',
      channel: 'portal-status',
      title: 'O Aluno Online voltou',
    }),
  );
  expect(store.data.get(`account-a/${PORTAL_RETURN_KEY}`)).toBeNull();
  expect(device.state.returnWatch).toBe(false);
  // o pedido já foi atendido: a tarefa para sem testar de novo
  await expect(alert.checkInBackground()).resolves.toBe('stopped');
  expect(probe).toHaveBeenCalledTimes(1);
});

it('keeps waiting while the portal is still down', async () => {
  const { alert, device } = setup({ answers: false });
  await alert.request();
  await expect(alert.checkInBackground()).resolves.toBe('waiting');
  expect(device.notify).not.toHaveBeenCalled();
  expect(device.state.returnWatch).toBe(true);
});

it('stops the watch without a valid request', async () => {
  const stale = setup({ now: NOW });
  stale.store.data.set(`account-a/${PORTAL_RETURN_KEY}`, {
    requestedAt: NOW - 4 * DAY,
  });
  await expect(stale.alert.checkInBackground()).resolves.toBe('stopped');
  expect(stale.probe).not.toHaveBeenCalled();
  expect(stale.device.setPortalReturnWatch).toHaveBeenCalledWith(false);

  const signedOut = setup({ account: null });
  await expect(signedOut.alert.checkInBackground()).resolves.toBe('stopped');

  const disabled = setup({ disabled: true });
  await disabled.alert.request();
  await expect(disabled.alert.checkInBackground()).resolves.toBe('stopped');
  expect(disabled.device.notify).not.toHaveBeenCalled();
});

it('ends the request on screen when the portal comes back, and on cancel', async () => {
  const back = setup();
  await back.alert.request();
  await back.alert.portalBack();
  expect(back.alert.getSnapshot().requested).toBe(false);
  expect(back.device.state.returnWatch).toBe(false);
  expect(back.device.notify).not.toHaveBeenCalled();

  const cancelled = setup();
  await cancelled.alert.request();
  await cancelled.alert.cancel();
  await cancelled.alert.load();
  expect(cancelled.alert.getSnapshot()).toEqual({
    scope: 'account-a',
    requested: false,
  });
});

it('waits, without cancelling the request, when the saved account does not open (screen locked)', async () => {
  const { alert, device, store, probe } = setup({ locked: true });
  store.data.set(`account-a/${PORTAL_RETURN_KEY}`, {
    requestedAt: NOW,
    via: 'device',
  });
  await expect(alert.checkInBackground()).resolves.toBe('waiting');
  expect(probe).not.toHaveBeenCalled();
  expect(device.setPortalReturnWatch).not.toHaveBeenCalled();
  expect(store.data.get(`account-a/${PORTAL_RETURN_KEY}`)).not.toBeNull();
});

describe('on the iPhone (push from the server)', () => {
  it('sends the request with the push token, without the device task', async () => {
    const push = createPushServer();
    const { alert, device, store } = setup({ push });
    await expect(alert.request()).resolves.toBe('requestedOnServer');
    expect(push.server.request).toHaveBeenCalledWith(push.token);
    expect(device.setPortalReturnWatch).not.toHaveBeenCalled();
    expect(store.data.get(`account-a/${PORTAL_RETURN_KEY}`)).toEqual({
      requestedAt: NOW,
      via: 'push',
    });
    // a tarefa do aparelho não cuida do pedido do servidor
    await expect(alert.checkInBackground()).resolves.toBe('stopped');
    expect(alert.getSnapshot().requested).toBe(true);
    expect(push.server.cancel).not.toHaveBeenCalled();
  });

  it('falls back to the device task without the token or the server', async () => {
    const noToken = setup({ push: createPushServer({ token: null }) });
    await noToken.alert.request();
    expect(noToken.device.state.returnWatch).toBe(true);

    const down = createPushServer({ available: false });
    const failing = setup({ push: down });
    await failing.alert.request();
    expect(down.server.request).toHaveBeenCalledTimes(1);
    expect(failing.device.state.returnWatch).toBe(true);
    expect(
      failing.store.data.get(`account-a/${PORTAL_RETURN_KEY}`),
    ).toMatchObject({ via: 'device' });
  });

  it('forgets the copy once the server already sent the push, and cancels there', async () => {
    const push = createPushServer();
    const sent = setup({ push });
    await sent.alert.request();
    await sent.alert.load();
    expect(sent.alert.getSnapshot().requested).toBe(true);
    push.pushed();
    await sent.alert.load();
    expect(sent.alert.getSnapshot().requested).toBe(false);
    expect(push.server.cancel).not.toHaveBeenCalled();

    const other = createPushServer();
    const cancelled = setup({ push: other });
    await cancelled.alert.request();
    await cancelled.alert.cancel();
    expect(other.server.cancel).toHaveBeenCalledTimes(1);
    await cancelled.alert.request();
    await cancelled.alert.portalBack();
    expect(other.server.cancel).toHaveBeenCalledTimes(2);
    await cancelled.alert.signOut();
    expect(other.server.cancel).toHaveBeenCalledTimes(3);
  });
});
