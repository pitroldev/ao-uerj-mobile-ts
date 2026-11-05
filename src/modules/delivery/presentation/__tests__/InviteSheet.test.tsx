import React from 'react';
import { Platform, Share } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { screen, userEvent } from '@testing-library/react-native';

import { snackbar } from '@components/ui';
import { renderWithProviders } from '@root/test-utils/render';
import { InviteSheet } from '../InviteSheet';
import { CAMPUS_INVITE, muralInvite } from '../inviteText';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: { setString: jest.fn() },
}));

const LINK = 'https://play.google.com/store/apps/details?id=com.aouerjmobile';

it('shows the message as it goes and sends it through the apps the student picks', async () => {
  const share = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
  const onClose = jest.fn();
  await renderWithProviders(
    <InviteSheet invite={muralInvite('Cálculo II', 3)} onClose={onClose} />,
  );
  const user = userEvent.setup();
  expect(
    screen.getByText(/Abri o mural de Cálculo II \(turma 3\) no AO UERJ/),
  ).toBeOnTheScreen();
  expect(screen.getByText('AO UERJ na Google Play')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Mandar' }));
  expect(share).toHaveBeenCalledWith({
    message: expect.stringContaining(`${LINK}&referrer=utm_source%3Dmural`),
  });
  expect(onClose).toHaveBeenCalled();
});

it('copies only the link, with the origin of the invite', async () => {
  await renderWithProviders(
    <InviteSheet invite={CAMPUS_INVITE} onClose={jest.fn()} />,
  );
  await userEvent
    .setup()
    .press(screen.getByRole('button', { name: 'Copiar link' }));
  expect(Clipboard.setString).toHaveBeenCalledWith(
    `${LINK}&referrer=utm_source%3Dcampus`,
  );
});

describe('the copy confirmation', () => {
  const original = { OS: Platform.OS, Version: Platform.Version };
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      value: original.OS,
      configurable: true,
    });
    Object.defineProperty(Platform, 'Version', {
      value: original.Version,
      configurable: true,
    });
  });
  const copyOn = async (version: number) => {
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });
    Object.defineProperty(Platform, 'Version', {
      value: version,
      configurable: true,
    });
    const success = jest.spyOn(snackbar, 'success').mockClear();
    await renderWithProviders(
      <InviteSheet invite={CAMPUS_INVITE} onClose={jest.fn()} />,
    );
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Copiar link' }));
    return success;
  };

  it('is left to the system from Android 13 on, which shows what was copied', async () => {
    expect(await copyOn(33)).not.toHaveBeenCalled();
  });

  it('is a snackbar on older Android', async () => {
    expect(await copyOn(31)).toHaveBeenCalledWith(
      'Link copiado',
      'Cole na conversa que quiser.',
    );
  });
});

it('shows the QR for the colleague next to the student', async () => {
  await renderWithProviders(
    <InviteSheet invite={CAMPUS_INVITE} onClose={jest.fn()} />,
  );
  await userEvent.setup().press(screen.getByRole('tab', { name: 'QR' }));
  expect(
    screen.getByLabelText('QR com o link do AO UERJ na Play Store'),
  ).toBeOnTheScreen();
  expect(screen.getByText('Aponte a câmera do celular')).toBeOnTheScreen();
  expect(screen.queryByText(/Quanto mais gente/)).toBeNull();
});

it('says so when the share list does not open', async () => {
  jest.spyOn(Share, 'share').mockRejectedValue(new Error('no activity'));
  const onClose = jest.fn();
  await renderWithProviders(
    <InviteSheet invite={CAMPUS_INVITE} onClose={onClose} />,
  );
  await userEvent.setup().press(screen.getByRole('button', { name: 'Mandar' }));
  expect(onClose).not.toHaveBeenCalled();
});
