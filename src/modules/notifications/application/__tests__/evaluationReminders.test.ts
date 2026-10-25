import type { EvaluationReminderPlan } from '@root/modules/evaluations/domain/reminders';
import { NotificationSettings, PREFERENCES_KEY } from '../NotificationSettings';
import {
  createAccount,
  createDevice,
  createRemote,
  createStore,
  settle,
} from './fakes';

const ACCOUNT = { scope: 'account-1', period: '2026.2' };

const plan = (title: string): EvaluationReminderPlan => ({
  reminders: [
    {
      id: `e1:eve@${title}`,
      evaluationId: 'e1',
      at: 1000,
      until: 2000,
      latest: 2000,
      local: {
        at: '2026-11-23T20:00',
        until: '2026-11-24T08:00',
        latest: '2026-11-24T08:00',
      },
      title,
      body: '',
      completable: false,
    },
  ],
});

function setup({
  saved,
  device = createDevice(),
  build = jest.fn(async () => plan('Amanhã: P1 de Física III')),
}: {
  saved?: Record<string, unknown>;
  device?: ReturnType<typeof createDevice>;
  build?: jest.Mock<Promise<EvaluationReminderPlan>>;
} = {}) {
  const store = createStore(
    saved ? { [`${ACCOUNT.scope}/${PREFERENCES_KEY}`]: saved } : {},
  );
  const account = createAccount();
  const remote = createRemote();
  const settings = new NotificationSettings({
    device,
    store,
    account: account.get,
    subscribeAccount: account.subscribe,
    remote,
    schedule: () => null,
    reminderText: () => ({ title: '', body: '' }),
    evaluationReminders: build,
  });
  settings.start();
  return { settings, device, account, remote, build };
}

it('schedules the evaluation reminders by default, with the permission', async () => {
  const { device, account, build } = setup();
  account.set(ACCOUNT);
  await settle();
  expect(build).toHaveBeenCalledWith(ACCOUNT);
  expect(device.state.evaluations?.reminders[0].title).toBe(
    'Amanhã: P1 de Física III',
  );
  // a aula continua opt-in
  expect(device.setClassReminders).toHaveBeenCalledWith(null);
});

it('replans when an evaluation changes, and only when the plan changes', async () => {
  const { settings, device, account, build } = setup();
  account.set(ACCOUNT);
  await settle();
  await settings.evaluationsChanged();
  expect(device.setEvaluationReminders).toHaveBeenCalledTimes(1);

  build.mockResolvedValueOnce(plan('Em 1 hora: P1 de Física III'));
  await settings.evaluationsChanged();
  expect(device.setEvaluationReminders).toHaveBeenCalledTimes(2);
  expect(device.state.evaluations?.reminders[0].title).toBe(
    'Em 1 hora: P1 de Física III',
  );
});

it('cancels them when turned off, without permission or remotely', async () => {
  const { settings, device, account, remote } = setup();
  account.set(ACCOUNT);
  await settle();
  await settings.update({ evaluationReminders: false });
  expect(device.state.evaluations).toBeNull();

  await settings.update({ evaluationReminders: true });
  expect(device.state.evaluations?.reminders).toHaveLength(1);
  remote.set(true);
  await settle();
  expect(device.state.evaluations).toBeNull();
});

it('keeps what is on the phone when the evaluations cannot be read', async () => {
  const build = jest.fn(async () => {
    throw new Error('disk');
  });
  const { device, account } = setup({ build });
  account.set(ACCOUNT);
  await settle();
  expect(device.setEvaluationReminders).not.toHaveBeenCalled();
});

it('does nothing without the permission and sends again for the next account', async () => {
  const denied = createDevice({ permission: 'denied' });
  const { device, account } = setup({ device: denied });
  account.set(ACCOUNT);
  await settle();
  expect(device.state.evaluations).toBeNull();

  const granted = setup();
  granted.account.set(ACCOUNT);
  await settle();
  granted.account.set(null);
  await settle();
  expect(granted.device.clearPosted).toHaveBeenCalled();
  granted.account.set({ scope: 'account-2', period: '2026.2' });
  await settle();
  // o aparelho limpou tudo no logout: o plano da conta nova vai de novo
  expect(granted.device.setEvaluationReminders).toHaveBeenLastCalledWith(
    plan('Amanhã: P1 de Física III'),
  );
});

it('saves quick changes of the defaults from the latest saved value', async () => {
  const { settings, account } = setup();
  account.set(ACCOUNT);
  await settle();
  const toggle = (key: 'week' | 'three') =>
    settings.update(current => ({
      evaluationDefaults: {
        ...current.evaluationDefaults,
        reminders: [...current.evaluationDefaults.reminders, key],
      },
    }));
  // os dois toques antes de a tela redesenhar: o segundo não desfaz o primeiro
  await Promise.all([toggle('week'), toggle('three')]);
  expect(
    settings.getSnapshot().preferences.evaluationDefaults.reminders,
  ).toEqual(['week', 'three', 'eve', 'day']);
});

it('does not send the previous account plan read during a sign out', async () => {
  let release: (plan: EvaluationReminderPlan) => void = () => undefined;
  const build = jest.fn(
    () =>
      new Promise<EvaluationReminderPlan>(resolve => {
        release = resolve;
      }),
  );
  const { settings, device, account } = setup({ build });
  account.set(ACCOUNT);
  await settle();
  const sent = device.setEvaluationReminders.mock.calls.length;
  const pending = settings.evaluationsChanged();
  await settle();
  // o logout limpa o aparelho enquanto as avaliações são lidas do disco
  account.set(null);
  await settle();
  release(plan('Amanhã: P1 de Física III'));
  await pending;
  await settle();
  expect(
    device.setEvaluationReminders.mock.calls
      .slice(sent)
      .some(([sentPlan]) => sentPlan !== null),
  ).toBe(false);
});
