import React from 'react';
import { Linking } from 'react-native';
import { act, screen, userEvent } from '@testing-library/react-native';

import { snackbar } from '@components/ui';
import { renderWithProviders } from '@root/test-utils/render';
import { AboutPage } from '../About';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@features/ErrorReport/ErrorReportModal', () => ({
  ErrorReportModal: 'ErrorReportModal',
}));

beforeEach(async () => {
  jest.mocked(Linking.openURL).mockReset().mockResolvedValue(undefined);
  await renderWithProviders(<AboutPage />);
});

it('shows the approved copy and the blog link', () => {
  expect(screen.getByRole('header', { name: 'AO UERJ' })).toBeOnTheScreen();
  expect(screen.getByText(/^Versão \d+\.\d+\.\d+$/)).toBeOnTheScreen();
  expect(
    screen.getByText(
      'App de código aberto, sem vínculo com a UERJ. Usa sua conta do Aluno Online.',
    ),
  ).toBeOnTheScreen();
  for (const section of ['Fala! Sou o Petro.', 'Ajude a melhorar']) {
    expect(screen.getByRole('header', { name: section })).toBeOnTheScreen();
  }
  expect(
    screen.getByText(
      'Criei o AO UERJ pra facilitar seu dia a dia na faculdade.',
    ),
  ).toBeOnTheScreen();
  expect(screen.getByRole('link', { name: 'pitrol.dev' })).toBeOnTheScreen();
});

it('opens the report sheet from "Reportar problema"', async () => {
  // a folha simulada vira um elemento host: as props são o contrato com ela
  const sheet = () =>
    screen.container.queryAll(node => node.type === 'ErrorReportModal')[0];
  const user = userEvent.setup();
  expect(sheet()).toHaveProp('visible', false);
  await user.press(screen.getByRole('button', { name: /^Reportar problema/ }));
  expect(sheet()).toHaveProp('visible', true);
  await act(() => sheet().props.setVisibility(false));
  expect(sheet()).toHaveProp('visible', false);
});

it('opens the support, repository and developer links', async () => {
  const user = userEvent.setup();
  await user.press(screen.getByRole('link', { name: 'pitrol.dev' }));
  await user.press(screen.getByRole('link', { name: 'GitHub' }));
  await user.press(screen.getByRole('link', { name: /^Sugerir melhoria/ }));
  await user.press(screen.getByRole('link', { name: /^Ver código no GitHub/ }));
  await user.press(screen.getByRole('link', { name: 'LinkedIn' }));
  await user.press(screen.getByRole('link', { name: 'E-mail' }));
  expect(jest.mocked(Linking.openURL).mock.calls.map(c => c[0])).toEqual([
    'https://pitrol.dev/',
    'https://github.com/pitroldev',
    'https://github.com/pitroldev/ao-uerj-mobile-ts/issues',
    'https://github.com/pitroldev/ao-uerj-mobile-ts',
    'https://www.linkedin.com/in/petrocardoso/',
    'mailto:contato@pitrol.dev?subject=AO UERJ',
  ]);
});

it.each(['pitrol.dev', 'GitHub', 'LinkedIn', 'E-mail'])(
  'tells the student when %s cannot be opened',
  async label => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const showError = jest.spyOn(snackbar, 'error');
    jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error('sem app'));
    await userEvent.setup().press(screen.getByRole('link', { name: label }));
    expect(showError).toHaveBeenCalledWith('Não foi possível abrir este link.');
    log.mockRestore();
  },
);
