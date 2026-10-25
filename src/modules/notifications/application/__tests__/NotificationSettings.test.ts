import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../../domain/preferences';
import { NotificationSettings, PREFERENCES_KEY } from '../NotificationSettings';
import {
  createAccount,
  createDevice,
  createRemote,
  createStore,
  settle,
} from './fakes';

const ACCOUNT = { scope: 'account-1', period: '2026.2' };

const meeting = {
  class: {
    id: 'IME02-00001',
    name: 'Cálculo II',
    class: '3',
    avaLocation: '',
    uerjLocation: 'Sala 6019 B',
    status: 'ACTIVE',
  },
  dayAlias: 'Terça-feira',
  dayNumber: 2,
  subject_id: 'IME02-00001',
  periodAlias: 'T3',
  startTimeAlias: '14:20',
  endTimeAlias: '16:00',
  start_time_in_minutes: 860,
  end_time_in_minutes: 960,
} satisfies AttendedClassesSchedule;

function setup({
  saved,
  device = createDevice(),
  account = createAccount(),
  remote = createRemote(),
  schedule = { data: [meeting], updatedAt: 5000 },
}: {
  saved?: Record<string, unknown>;
  device?: ReturnType<typeof createDevice> | null;
  account?: ReturnType<typeof createAccount>;
  remote?: ReturnType<typeof createRemote>;
  schedule?: { data: AttendedClassesSchedule[]; updatedAt: number } | null;
} = {}) {
  const store = createStore(
    saved ? { [`${ACCOUNT.scope}/${PREFERENCES_KEY}`]: saved } : {},
  );
  const current = { schedule };
  const settings = new NotificationSettings({
    device,
    store,
    account: account.get,
    subscribeAccount: account.subscribe,
    remote,
    schedule: () => current.schedule,
    reminderText: item => ({
      title: `${item.class.name} às ${item.startTimeAlias}`,
      body: item.class.uerjLocation,
    }),
  });
  settings.start();
  return { settings, store, device, account, remote, current };
}

it('changes nothing on the device while the account is being restored', async () => {
  const { device } = setup();
  await settle();
  expect(device!.setClassReminders).not.toHaveBeenCalled();
  expect(device!.setPortalCheck).not.toHaveBeenCalled();
});

it('cancels everything once the app knows nobody is signed in', async () => {
  const { device, account } = setup();
  account.set(null);
  await settle();
  expect(device!.setClassReminders).toHaveBeenCalledWith(null);
  expect(device!.setPortalCheck).toHaveBeenCalledWith(false, 4);
});

it('loads the saved choices and schedules reminders and the portal check', async () => {
  const { settings, device, account } = setup({
    saved: { classReminders: true, reminderLead: 10, grades: true },
  });
  account.set(ACCOUNT);
  await settle();
  expect(settings.getSnapshot()).toMatchObject({
    supported: true,
    ready: true,
    permission: 'granted',
    exactAlarms: true,
    preferences: { classReminders: true, reminderLead: 10, grades: true },
  });
  expect(device!.state.plan).toEqual({
    expiresAt: expect.any(Number),
    leadMinutes: 10,
    reminders: [
      expect.objectContaining({
        weekday: 2,
        minutes: 850,
        title: 'Cálculo II às 14:20',
      }),
    ],
  });
  expect(device!.state.portal).toBe(true);
});

it('schedules only the reminders where there is no background check (iOS)', async () => {
  const { settings, device, account } = setup({
    device: createDevice({ backgroundChecks: false }),
    saved: { classReminders: true, grades: true },
  });
  account.set(ACCOUNT);
  await settle();
  expect(settings.getSnapshot()).toMatchObject({
    supported: true,
    backgroundChecks: false,
  });
  expect(device!.state.plan?.reminders).toHaveLength(1);
  expect(device!.setPortalCheck).not.toHaveBeenCalledWith(true, 4);
  expect(device!.state.portal).toBe(false);
});

it('asks for the permission when a notification is turned on', async () => {
  const device = createDevice({ permission: 'denied', request: 'granted' });
  const { settings, store, account } = setup({ device });
  account.set(ACCOUNT);
  await settle();
  expect(device.state.portal).toBe(false);

  await expect(settings.update({ grades: true })).resolves.toBe('saved');
  expect(device.requestPermission).toHaveBeenCalledTimes(1);
  expect(store.data.get(`${ACCOUNT.scope}/${PREFERENCES_KEY}`)).toMatchObject({
    grades: true,
  });
  expect(device.state.portal).toBe(true);
});

it.each(['denied', 'blocked'] as const)(
  'keeps the notification off when the permission is %s',
  async request => {
    const device = createDevice({ permission: 'denied', request });
    const { settings, store, account } = setup({ device });
    account.set(ACCOUNT);
    await settle();

    await expect(settings.update({ classReminders: true })).resolves.toBe(
      request,
    );
    expect(settings.getSnapshot()).toMatchObject({
      permission: request,
      preferences: { classReminders: false },
    });
    expect(store.write).not.toHaveBeenCalled();
  },
);

it('does not ask again to turn something off or change the lead', async () => {
  const device = createDevice({ permission: 'denied' });
  const { settings, account } = setup({
    device,
    saved: { classReminders: true },
  });
  account.set(ACCOUNT);
  await settle();
  await expect(settings.update({ reminderLead: 30 })).resolves.toBe('saved');
  await expect(settings.update({ classReminders: false })).resolves.toBe(
    'saved',
  );
  expect(device.requestPermission).not.toHaveBeenCalled();
});

it('replans the reminders when the saved schedule or the lead changes', async () => {
  const { settings, device, account, current } = setup({
    saved: { classReminders: true },
  });
  account.set(ACCOUNT);
  await settle();
  expect(device!.setClassReminders).toHaveBeenCalledTimes(1);

  await settings.scheduleChanged();
  expect(device!.setClassReminders).toHaveBeenCalledTimes(1);

  current.schedule = {
    data: [meeting, { ...meeting, dayNumber: 4 }],
    updatedAt: 9000,
  };
  await settings.scheduleChanged();
  expect(device!.state.plan?.reminders).toHaveLength(2);

  await settings.update({ reminderLead: 30 });
  expect(device!.state.plan?.reminders[0].minutes).toBe(830);
});

it('cancels everything on sign out and when the remote switch turns notifications off', async () => {
  const { device, account, remote, settings } = setup({
    saved: { classReminders: true, rid: true },
  });
  account.set(ACCOUNT);
  await settle();
  expect(device!.state).toMatchObject({ portal: true });

  remote.set(true);
  await settle();
  expect(settings.getSnapshot().remoteDisabled).toBe(true);
  expect(device!.state).toMatchObject({ plan: null, portal: false });

  remote.set(false);
  await settle();
  expect(device!.state.portal).toBe(true);

  account.set(null);
  await settle();
  expect(device!.state).toMatchObject({ plan: null, portal: false });
  expect(settings.getSnapshot()).toMatchObject({
    ready: false,
    preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  });
});

it('stops when the permission is withdrawn in the system settings', async () => {
  const { device, account, settings } = setup({
    saved: { classReminders: true },
  });
  account.set(ACCOUNT);
  await settle();
  device!.state.permission = 'denied';
  await settings.refreshDevice();
  expect(device!.state.plan).toBeNull();
});

it('answers the Home prompt once, enabling or not', async () => {
  const { settings, account, device } = setup();
  account.set(ACCOUNT);
  await settle();
  await expect(settings.answerPrompt(true)).resolves.toBe('saved');
  expect(settings.getSnapshot().preferences).toMatchObject({
    promptAnswered: true,
    classReminders: true,
  });
  expect(device!.state.plan?.reminders).toHaveLength(1);

  const other = setup({
    device: createDevice({ permission: 'denied', request: 'denied' }),
  });
  other.account.set(ACCOUNT);
  await settle();
  await expect(other.settings.answerPrompt(true)).resolves.toBe('denied');
  expect(other.settings.getSnapshot().preferences).toMatchObject({
    promptAnswered: true,
    classReminders: false,
  });
});

it('is inert without the native module', async () => {
  const { settings, account } = setup({ device: null });
  account.set(ACCOUNT);
  await settle();
  expect(settings.getSnapshot()).toMatchObject({
    supported: false,
    ready: true,
  });
  await expect(settings.requestPermission()).resolves.toBe('blocked');
});

it('saves quick choices one after the other without undoing the first', async () => {
  const { settings, store, account } = setup();
  account.set(ACCOUNT);
  await settle();
  await Promise.all([
    settings.update({ rid: true }),
    settings.update({ documents: true }),
  ]);
  expect(settings.getSnapshot().preferences).toMatchObject({
    rid: true,
    documents: true,
  });
  expect(store.data.get(`${ACCOUNT.scope}/${PREFERENCES_KEY}`)).toMatchObject({
    rid: true,
    documents: true,
  });
});

it('keeps the device as it was when the saved choices cannot be read, and reads again later', async () => {
  const { settings, store, account, device } = setup({
    saved: { classReminders: true },
  });
  store.read.mockRejectedValueOnce(new Error('disco'));
  account.set(ACCOUNT);
  await settle();
  expect(settings.getSnapshot().ready).toBe(false);
  expect(device!.setClassReminders).not.toHaveBeenCalled();
  expect(device!.setPortalCheck).not.toHaveBeenCalled();

  // a volta ao app tenta de novo
  await settings.refreshDevice();
  expect(settings.getSnapshot()).toMatchObject({
    ready: true,
    preferences: { classReminders: true },
  });
  expect(device!.state.plan?.reminders).toHaveLength(1);
});

it('remembers a refusal for good until the system settings allow notifications', async () => {
  const device = createDevice({ permission: 'denied', request: 'blocked' });
  const { settings, account } = setup({ device });
  account.set(ACCOUNT);
  await settle();
  await expect(settings.update({ grades: true })).resolves.toBe('blocked');
  // o sistema só informa se os avisos estão liberados, não a recusa de vez
  device.state.permission = 'denied';
  await settings.refreshDevice();
  expect(settings.getSnapshot().permission).toBe('blocked');

  device.state.permission = 'granted';
  await settings.refreshDevice();
  expect(settings.getSnapshot().permission).toBe('granted');
});

it('keeps the scheduled reminders while the saved schedule is unavailable', async () => {
  const { device, account } = setup({
    saved: { classReminders: true },
    schedule: null,
  });
  account.set(ACCOUNT);
  await settle();
  expect(device!.setClassReminders).not.toHaveBeenCalled();
  expect(device!.setPortalCheck).toHaveBeenCalledWith(false, 4);
});

it('takes the notifications already shown off the shade on sign out or account switch', async () => {
  const { device, account } = setup({ saved: { grades: true } });
  account.set(ACCOUNT);
  await settle();
  // a abertura do app não apaga nada
  expect(device!.clearPosted).not.toHaveBeenCalled();

  account.set({ scope: 'account-2', period: '2026.2' });
  await settle();
  expect(device!.clearPosted).toHaveBeenCalledTimes(1);

  account.set(null);
  await settle();
  expect(device!.clearPosted).toHaveBeenCalledTimes(2);
});

it('clears the device when the restore ends without the account', async () => {
  // runtime novo e senha recusada: não há conta anterior conhecida
  const { device, account } = setup();
  account.set(null);
  await settle();
  expect(device!.clearPosted).toHaveBeenCalledTimes(1);
  expect(device!.state).toMatchObject({ plan: null, portal: false });
});

it('sends the reminders of the next account again after clearing the device', async () => {
  const { device, account, store } = setup({ saved: { classReminders: true } });
  store.data.set('account-2/notifications', { classReminders: true });
  account.set(ACCOUNT);
  await settle();
  expect(device!.state.plan?.reminders).toHaveLength(1);

  // a conta nova tem o mesmo plano, mas limpar a barra cancelou o anterior
  account.set({ scope: 'account-2', period: '2026.2' });
  await settle();
  expect(device!.clearPosted).toHaveBeenCalledTimes(1);
  expect(device!.setClassReminders).toHaveBeenCalledTimes(2);
  expect(device!.state.plan?.reminders).toHaveLength(1);
});

it.each([
  ['turns notifications off', false],
  ['already had notifications off', true],
])(
  'cancels everything while the account is restored when the remote switch %s',
  async (_case, disabledAtStart) => {
    // a tarefa sem tela termina sem restaurar a conta
    const remote = createRemote(disabledAtStart);
    const { device } = setup({ remote, saved: { classReminders: true } });
    await settle();
    remote.set(true);
    await settle();
    expect(device!.setClassReminders).toHaveBeenCalledWith(null);
    expect(device!.setPortalCheck).toHaveBeenCalledWith(false, 4);
    expect(device!.clearPosted).not.toHaveBeenCalled();
  },
);
