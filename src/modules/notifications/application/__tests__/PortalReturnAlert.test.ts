import type { PermissionState } from '../ports';
import { PORTAL_RETURN_KEY, PortalReturnAlert } from '../PortalReturnAlert';
import { createDevice, createStore } from './fakes';

const ACCOUNT = { scope: 'account-a', period: '2026.2' };
const NOW = Date.UTC(2026, 9, 22, 17);
const DAY = 24 * 60 * 60 * 1000;

function setup({
  request = 'granted',
  answers = true,
  disabled = false,
  account = ACCOUNT,
  now = NOW,
}: {
  request?: PermissionState;
  answers?: boolean;
  disabled?: boolean;
  account?: typeof ACCOUNT | null;
  now?: number;
} = {}) {
  const device = createDevice({ request, permission: 'denied' });
  const store = createStore();
  const probe = jest.fn(async () => answers);
  const alert = new PortalReturnAlert({
    device,
    store,
    account: () => account,
    savedScope: async () => account?.scope ?? null,
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
