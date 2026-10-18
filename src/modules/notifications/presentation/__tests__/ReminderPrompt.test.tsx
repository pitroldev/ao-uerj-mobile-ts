import React from 'react';
import { act, screen, userEvent } from '@testing-library/react-native';

import { snackbar } from '@components/ui';
import { renderWithProviders } from '@root/test-utils/render';
import { NotificationSettings } from '../../application/NotificationSettings';
import {
  createAccount,
  createDevice,
  createRemote,
  createStore,
  settle,
} from '../../application/__tests__/fakes';
import { ReminderPrompt } from '../ReminderPrompt';

let mockSettings: NotificationSettings;
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({ notifications: { settings: mockSettings } }),
}));

const ACCOUNT = { scope: 'account-1', period: '2026.2' };

async function mount({
  device = createDevice(),
  saved,
  remote = createRemote(),
}: {
  device?: ReturnType<typeof createDevice>;
  saved?: Record<string, unknown>;
  remote?: ReturnType<typeof createRemote>;
} = {}) {
  mockSettings = new NotificationSettings({
    device,
    store: createStore(
      saved ? { [`${ACCOUNT.scope}/notifications`]: saved } : {},
    ),
    account: createAccount(ACCOUNT).get,
    subscribeAccount: () => () => undefined,
    remote,
    schedule: () => null,
    reminderText: () => ({ title: '', body: '' }),
  });
  mockSettings.start();
  await act(settle);
  await renderWithProviders(<ReminderPrompt />);
  return device;
}

it('turns the reminders on and does not come back', async () => {
  const success = jest
    .spyOn(snackbar, 'success')
    .mockImplementation(() => undefined);
  await mount();
  expect(
    screen.getByText(
      'Quer um aviso 15 minutos antes de cada aula, com o horário e a sala?',
    ),
  ).toBeOnTheScreen();

  await userEvent.press(screen.getByText('Ativar lembretes'));
  await act(settle);
  expect(mockSettings.getSnapshot().preferences).toMatchObject({
    classReminders: true,
    promptAnswered: true,
  });
  expect(success).toHaveBeenCalledWith('Lembretes ligados', expect.any(String));
  expect(screen.queryByText('Ativar lembretes')).toBeNull();
});

it('is dismissed for good with "Agora não", without asking for the permission', async () => {
  const device = await mount({
    device: createDevice({ permission: 'denied' }),
  });
  await userEvent.press(screen.getByText('Agora não'));
  await act(settle);
  expect(mockSettings.getSnapshot().preferences).toMatchObject({
    classReminders: false,
    promptAnswered: true,
  });
  expect(device.requestPermission).not.toHaveBeenCalled();
  expect(screen.queryByText('Agora não')).toBeNull();
});

it('explains when the permission is refused', async () => {
  const info = jest.spyOn(snackbar, 'info').mockImplementation(() => undefined);
  await mount({
    device: createDevice({ permission: 'denied', request: 'denied' }),
  });
  await userEvent.press(screen.getByText('Ativar lembretes'));
  await act(settle);
  expect(info).toHaveBeenCalledWith(
    'Lembretes não ligados',
    expect.any(String),
  );
  expect(screen.queryByText('Ativar lembretes')).toBeNull();
});

it.each([
  ['already answered', { saved: { promptAnswered: true } }],
  ['reminders already on', { saved: { classReminders: true } }],
  ['turned off remotely', { remote: createRemote(true) }],
])('stays hidden when %s', async (_case, options) => {
  await mount(options);
  expect(screen.queryByText('Ativar lembretes')).toBeNull();
});
