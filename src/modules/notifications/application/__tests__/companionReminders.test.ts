import type { CompanionReminderPlan } from '@root/modules/companion/domain/reminders';
import { NotificationSettings } from '../NotificationSettings';
import {
  createAccount,
  createDevice,
  createRemote,
  createStore,
  settle,
} from './fakes';

const ACCOUNT = { scope: 'account-1', period: '2026.2' };

const plan = (title: string): CompanionReminderPlan => ({
  reminders: [
    {
      id: `c1:soon@${title}`,
      callId: 'c1',
      at: 1000,
      until: 2000,
      local: { at: '2026-11-23T22:05', until: '2026-11-23T22:15' },
      title,
      body: 'Concha Acústica, 22:15.',
    },
  ],
});

function setup(device = createDevice()) {
  const account = createAccount();
  const remote = createRemote();
  const build = jest.fn(async () => plan('A volta é em 10 min'));
  const settings = new NotificationSettings({
    device,
    store: createStore(),
    account: account.get,
    subscribeAccount: account.subscribe,
    remote,
    schedule: () => null,
    reminderText: () => ({ title: '', body: '' }),
    companionReminders: build,
  });
  settings.start();
  return { settings, device, account, remote, build };
}

it('schedules the reminders of the calls the student is in, by default', async () => {
  const { device, account } = setup();
  account.set(ACCOUNT);
  await settle();
  expect(device.state.companion?.reminders[0].title).toBe(
    'A volta é em 10 min',
  );
});

it('replans when a call changes and only sends a different plan', async () => {
  const { settings, device, account, build } = setup();
  account.set(ACCOUNT);
  await settle();
  await settings.companionChanged();
  expect(device.setCompanionReminders).toHaveBeenCalledTimes(1);
  build.mockResolvedValueOnce(plan('Chegou bem?'));
  await settings.companionChanged();
  expect(device.state.companion?.reminders[0].title).toBe('Chegou bem?');
});

it('cancels them when turned off, without permission or remotely', async () => {
  const { settings, device, account, remote } = setup();
  account.set(ACCOUNT);
  await settle();
  await settings.update({ companionReminders: false });
  expect(device.state.companion).toBeNull();
  await settings.update({ companionReminders: true });
  expect(device.state.companion?.reminders).toHaveLength(1);
  remote.set(true);
  await settle();
  expect(device.state.companion).toBeNull();

  const denied = setup(createDevice({ permission: 'denied' }));
  denied.account.set(ACCOUNT);
  await settle();
  expect(denied.device.state.companion).toBeNull();
});
