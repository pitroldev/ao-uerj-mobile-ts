import React from 'react';
import { Platform } from 'react-native';
import {
  act,
  fireEvent,
  screen,
  userEvent,
} from '@testing-library/react-native';

import { snackbar } from '@components/ui';
import { renderWithProviders } from '@root/test-utils/render';
import { NotificationSettings } from '@root/modules/notifications/application/NotificationSettings';
import {
  createAccount,
  createDevice,
  createRemote,
  createStore,
  settle,
} from '@root/modules/notifications/application/__tests__/fakes';
import type { CheckState } from '@root/modules/notifications/domain/checkState';
import { NotificationsPage } from '../Notifications';

let mockSettings: NotificationSettings;
/** Há a sessão de aluno neste aparelho (a Companhia agora existe). */
let mockCompanion = false;
/** O Agora no campus existe (sessão de aluno). */
let mockCampus = false;
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({
    notifications: { settings: mockSettings },
    companion: { supported: mockCompanion },
    campusNow: { supported: mockCampus },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const ACCOUNT = { scope: 'account-1', period: '2026.2' };

// a tela como no Android (os textos citam o sistema); o iPhone tem teste próprio
const originalOS = Platform.OS;
const setOS = (value: typeof Platform.OS) =>
  Object.defineProperty(Platform, 'OS', { value, configurable: true });
beforeEach(() => setOS('android'));
afterEach(() => setOS(originalOS));

async function mount({
  device = createDevice(),
  saved,
}: {
  device?: ReturnType<typeof createDevice> | null;
  saved?: Record<string, unknown>;
} = {}) {
  const store = createStore(
    saved ? { [`${ACCOUNT.scope}/notifications`]: saved } : {},
  );
  mockSettings = new NotificationSettings({
    device,
    store,
    account: createAccount(ACCOUNT).get,
    subscribeAccount: () => () => undefined,
    remote: createRemote(),
    schedule: () => null,
    reminderText: () => ({ title: '', body: '' }),
  });
  mockSettings.start();
  await act(settle);
  await renderWithProviders(<NotificationsPage />);
  return { device, store };
}

const row = (name: string) =>
  screen.getByRole('switch', { name: new RegExp(name) });

it('turns the class reminder on and offers the lead time', async () => {
  const { device } = await mount();
  expect(row('Lembrete antes da aula')).not.toBeChecked();
  expect(screen.queryByText('Avisar antes do início')).toBeNull();

  await userEvent.press(row('Lembrete antes da aula'));
  await act(settle);
  expect(row('Lembrete antes da aula')).toBeChecked();
  expect(screen.getByText('Avisar antes do início')).toBeOnTheScreen();

  await userEvent.press(screen.getByLabelText('30 minutos antes'));
  await act(settle);
  expect(mockSettings.getSnapshot().preferences.reminderLead).toBe(30);
  expect(device!.requestPermission).not.toHaveBeenCalled();
});

it('describes the RID and the document notices as the app and the check do', async () => {
  await mount();
  expect(
    screen.getByText('Posição no RID Parcial e resultado da inscrição.'),
  ).toBeOnTheScreen();
  expect(
    screen.getByText('Até 3 dias antes do vencimento de um documento emitido.'),
  ).toBeOnTheScreen();
});

it('shows the grade value switch only with grade notifications on', async () => {
  await mount({ saved: { grades: true } });
  expect(row('Notas novas')).toBeChecked();
  expect(row('Mostrar a nota no aviso')).not.toBeChecked();
  expect(
    screen.getByText('A primeira verificação acontece nas próximas horas.'),
  ).toBeOnTheScreen();
});

it('explains a refused permission and keeps the switch off', async () => {
  const info = jest.spyOn(snackbar, 'info').mockImplementation(() => undefined);
  const device = createDevice({ permission: 'denied', request: 'blocked' });
  await mount({ device });

  await userEvent.press(row('RID'));
  await act(settle);
  // na volta do diálogo o sistema só diz "não permitido"; a recusa de vez fica
  device.state.permission = 'denied';
  await act(() => mockSettings.refreshDevice());
  expect(row('RID')).not.toBeChecked();
  expect(info).toHaveBeenCalledWith(
    'Avisos bloqueados no Android',
    expect.any(String),
  );
  expect(
    screen.getByText('O Android está bloqueando os avisos do AO UERJ.'),
  ).toBeOnTheScreen();
  await userEvent.press(
    screen.getByRole('button', {
      name: 'Abrir as configurações de avisos do Android',
    }),
  );
  expect(device.openSettings).toHaveBeenCalled();
});

it('says how often the Android checks the portal, with nothing else to ask', async () => {
  await mount({ saved: { grades: true } });
  expect(
    screen.getByText(
      'O app consulta o portal a cada 4 horas, das 7h às 22h, com a conta salva neste aparelho.',
    ),
  ).toBeOnTheScreen();
  expect(screen.queryByText(/Atualização em 2º Plano/)).toBeNull();
});

it('explains on the iPhone that iOS picks when the app looks at the portal', async () => {
  setOS('ios');
  const device = createDevice({ frequentWatches: false });
  await mount({ device, saved: { grades: true } });
  expect(
    screen.getByText(
      'O iPhone escolhe quando o app pode olhar o portal, das 7h às 22h, com a conta salva neste aparelho. Por isso, o aviso pode chegar horas depois.',
    ),
  ).toBeOnTheScreen();
  expect(
    screen.getByText(
      'Precisa da Atualização em 2º Plano ligada nos Ajustes. Se você fechar o app no seletor de apps, o iPhone só volta a olhar depois que você abrir o app de novo.',
    ),
  ).toBeOnTheScreen();
  expect(row('Notas novas')).toBeChecked();
  await userEvent.press(row('RID'));
  await act(settle);
  expect(row('RID')).toBeChecked();
  expect(device.setPortalCheck).toHaveBeenLastCalledWith(true, 4);
  // as palavras dos alunos: nada de "chamada"
  expect(screen.queryAllByText(/chamada/i)).toHaveLength(0);
});

it('shows only the reminders where there is no background check, in the iPhone words', async () => {
  setOS('ios');
  const info = jest.spyOn(snackbar, 'info').mockImplementation(() => undefined);
  const device = createDevice({
    permission: 'denied',
    request: 'blocked',
    backgroundChecks: false,
  });
  await mount({ device });
  // sem a verificação em segundo plano, sem os avisos do Aluno Online
  expect(screen.queryByText('Aluno Online')).toBeNull();
  expect(screen.queryByRole('switch', { name: /Notas novas/ })).toBeNull();

  await userEvent.press(row('Lembrete antes da aula'));
  await act(settle);
  expect(row('Lembrete antes da aula')).not.toBeChecked();
  expect(info).toHaveBeenCalledWith(
    'Avisos bloqueados no iPhone',
    'Toque em “Abrir Ajustes”, no topo da tela, para liberar.',
  );
  expect(
    screen.getByText('O iPhone está bloqueando os avisos do AO UERJ.'),
  ).toBeOnTheScreen();
  await userEvent.press(
    screen.getByRole('button', {
      name: 'Abrir os Ajustes de avisos do iPhone',
    }),
  );
  expect(device.openSettings).toHaveBeenCalled();
  expect(device.setPortalCheck).not.toHaveBeenCalledWith(
    true,
    expect.any(Number),
  );
});

it('asks for the permission again from the notice when it can', async () => {
  const device = createDevice({ permission: 'denied', request: 'granted' });
  await mount({ device, saved: { classReminders: true } });
  expect(
    screen.getByText('Os avisos precisam da sua permissão no Android.'),
  ).toBeOnTheScreen();
  await userEvent.press(
    screen.getByRole('button', { name: 'Permitir avisos' }),
  );
  await act(settle);
  expect(device.requestPermission).toHaveBeenCalled();
  expect(
    screen.queryByText('Os avisos precisam da sua permissão no Android.'),
  ).toBeNull();
});

it('points to the exact alarm setting when reminders are on without it', async () => {
  const device = createDevice({ exactAlarms: false });
  await mount({ device, saved: { classReminders: true } });
  await userEvent.press(
    screen.getByRole('button', { name: 'Permitir alarmes e lembretes' }),
  );
  expect(device.openExactAlarmSettings).toHaveBeenCalled();
});

it('shows the result of the last portal check', async () => {
  await mount({ saved: { documents: true } });
  const check: CheckState = {
    lastRunAt: Date.now(),
    lastOutcome: 'offline',
    goodNewsAt: null,
    pausedUntil: null,
    documentsCheckedAt: null,
    notifiedDocuments: [],
    known: null,
  };
  await act(() => mockSettings.checkRecorded(ACCOUNT.scope, check));
  expect(screen.getByText(/sem conexão\.$/)).toBeOnTheScreen();
});

it('explains when the device has no support', async () => {
  await mount({ device: null });
  expect(
    screen.getByText(
      'Os avisos do AO UERJ ainda não estão disponíveis neste aparelho.',
    ),
  ).toBeOnTheScreen();
});

it('keeps the evaluation reminders on and changes the defaults of the next ones', async () => {
  const { store } = await mount();
  expect(row('Lembretes de avaliações')).toBeChecked();
  expect(screen.getByText('Padrão das novas avaliações')).toBeOnTheScreen();
  const chip = (name: string) =>
    screen.getByRole('togglebutton', { name }).props.accessibilityState;
  expect(chip('Na véspera')).toMatchObject({ checked: true });
  expect(chip('No dia')).toMatchObject({ checked: true });
  expect(chip('1 h antes')).toMatchObject({ checked: false });

  await userEvent.press(
    screen.getByRole('togglebutton', { name: '1 h antes' }),
  );
  await act(settle);
  await fireEvent.changeText(
    screen.getByLabelText('Horário padrão dos lembretes de dias antes'),
    '1930',
  );
  await act(settle);
  expect(mockSettings.getSnapshot().preferences.evaluationDefaults).toEqual({
    reminders: ['eve', 'day', 'h1'],
    earlyTime: 19 * 60 + 30,
    dayTime: 7 * 60,
  });
  expect(store.data.get(`${ACCOUNT.scope}/notifications`)).toMatchObject({
    evaluationDefaults: { reminders: ['eve', 'day', 'h1'] },
  });

  await userEvent.press(row('Lembretes de avaliações'));
  await act(settle);
  expect(row('Lembretes de avaliações')).not.toBeChecked();
  expect(screen.queryByText('Padrão das novas avaliações')).toBeNull();
});

it('asks for the permission the evaluation reminders need, without a banner on top', async () => {
  const device = createDevice({ permission: 'denied' });
  await mount({ device });
  // nenhum outro aviso ligado: o pedido do topo não aparece
  expect(screen.queryByText(/Os avisos precisam da sua permissão/)).toBeNull();
  expect(
    screen.getByText(
      'Sem a sua permissão, os lembretes das avaliações não chegam.',
    ),
  ).toBeOnTheScreen();
  await userEvent.press(
    screen.getByRole('button', { name: 'Permitir avisos' }),
  );
  await act(settle);
  expect(device.requestPermission).toHaveBeenCalled();
  expect(
    screen.queryByText(
      'Sem a sua permissão, os lembretes das avaliações não chegam.',
    ),
  ).toBeNull();
});

it('turns the Companhia agora reminders off where the device has the feature', async () => {
  mockCompanion = true;
  try {
    await mount();
    expect(row('Avisos das mesas e grupos')).toBeChecked();
    await userEvent.press(row('Avisos das mesas e grupos'));
    await act(settle);
    expect(mockSettings.getSnapshot().preferences.companionReminders).toBe(
      false,
    );
  } finally {
    mockCompanion = false;
  }
});

it('leaves the Companhia agora reminders out without anonymous tokens', async () => {
  await mount();
  expect(screen.queryByText('Avisos das mesas e grupos')).toBeNull();
});

it('turns the Agora no campus notices off where the app signs in as a student', async () => {
  mockCampus = true;
  try {
    await mount();
    expect(row('Avisos no caminho das aulas')).toBeChecked();
    await userEvent.press(row('Avisos no caminho das aulas'));
    await act(settle);
    expect(mockSettings.getSnapshot().preferences.campusAlerts).toBe(false);
  } finally {
    mockCampus = false;
  }
});

it('leaves the Agora no campus notices out without the student session or on the iPhone', async () => {
  await mount();
  expect(screen.queryByText('Avisos no caminho das aulas')).toBeNull();
  // no iPhone, mesmo com a sessão de aluno: o iOS não acorda o app a cada 15 minutos
  mockCampus = true;
  setOS('ios');
  try {
    await mount({ device: createDevice({ frequentWatches: false }) });
    expect(screen.queryByText('Aluno Online')).toBeOnTheScreen();
    expect(screen.queryByText('Avisos no caminho das aulas')).toBeNull();
  } finally {
    mockCampus = false;
  }
});
