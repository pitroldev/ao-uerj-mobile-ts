import React from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';

import { DARK, LIGHT } from '@root/themes';
import { renderWithProviders } from '@root/test-utils/render';
import { ErrorBoundary } from '@components/ErrorBoundary';
import { ScreenPanel } from '@templates/ScreenPanel';
import {
  BottomSheet,
  Button,
  Notice,
  Table,
  TableRow,
  Text,
} from '@components/ui';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));

afterEach(() => {
  jest.mocked(useColorScheme).mockReturnValue('light');
});

/** Cor do primeiro fundo pintado atrás do elemento (fundos são decorativos). */
function backgroundBehind(element: TestInstance | null) {
  for (let node = element; node; node = node.parent) {
    const { backgroundColor } = StyleSheet.flatten(node.props.style) ?? {};
    if (backgroundColor && backgroundColor !== 'transparent') {
      return backgroundColor;
    }
  }
  return undefined;
}

it('fills the primary action with the medium blue that holds white text', async () => {
  await renderWithProviders(<Button label="Salvar" />, { theme: 'dark' });
  expect(screen.getByRole('button', { name: 'Salvar' })).toHaveStyle({
    backgroundColor: DARK.colors.fill,
  });
  expect(screen.getByText('Salvar')).toHaveStyle({
    color: DARK.colors.onFill,
  });
  // no claro o preenchimento é o próprio acento
  await renderWithProviders(<Button label="Salvar" />);
  expect(screen.getByRole('button', { name: 'Salvar' })).toHaveStyle({
    backgroundColor: LIGHT.colors.accent,
  });
});

it('calms warning notices and tints their action with the tone in the dark', async () => {
  const notice = (
    <Notice
      testID="notice"
      kind="refreshFailed"
      text="Não foi possível atualizar."
      onRetry={jest.fn()}
    />
  );
  await renderWithProviders(notice, { theme: 'dark' });
  expect(screen.getByTestId('notice')).toHaveStyle({
    backgroundColor: DARK.status.warn.wash,
    borderColor: DARK.status.warn.washLine,
  });
  // sem o azul, a ação sublinhada continua lida como link
  expect(screen.getByText('Tentar novamente')).toHaveStyle({
    color: DARK.colors.noticeWarnAction,
    textDecorationLine: 'underline',
  });

  await renderWithProviders(notice);
  expect(screen.getByTestId('notice')).toHaveStyle({
    backgroundColor: LIGHT.status.warn.bg,
  });
  expect(screen.getByText('Tentar novamente')).toHaveStyle({
    color: LIGHT.colors.accent,
  });
  expect(screen.getByText('Tentar novamente')).not.toHaveStyle({
    textDecorationLine: 'underline',
  });
});

it('raises the surfaces one step inside a dark sheet', async () => {
  await renderWithProviders(
    <>
      <Notice testID="outside" tone="neutral" text="No painel" />
      <BottomSheet visible onClose={jest.fn()} title="Folha">
        <Notice testID="inside" tone="neutral" text="Na folha" />
      </BottomSheet>
    </>,
    { theme: 'dark' },
  );
  expect(screen.getByTestId('outside')).toHaveStyle({
    backgroundColor: DARK.colors.surfaceMuted,
    borderColor: DARK.colors.rule,
  });
  expect(screen.getByTestId('inside')).toHaveStyle({
    backgroundColor: DARK.sheetColors.surfaceMuted,
    borderColor: DARK.sheetColors.rule,
  });
});

it('paints the panel and the table header band from the dark palette', async () => {
  const columns = [
    { key: 'name', label: 'Disciplina' },
    { key: 'p1', label: 'P1', width: 45 },
  ];
  const screenContent = (
    <ScreenPanel testID="panel" scroll={false}>
      <Table columns={columns}>
        <TableRow>
          <Text>Cálculo I</Text>
          <Text>8,0</Text>
        </TableRow>
      </Table>
    </ScreenPanel>
  );
  await renderWithProviders(screenContent, { theme: 'dark' });
  expect(screen.getByTestId('panel')).toHaveStyle({
    backgroundColor: DARK.colors.background,
  });
  // o cabeçalho sobe um degrau: faixa elevada sobre o fundo do painel
  expect(backgroundBehind(screen.getByText('P1'))).toBe(DARK.colors.surface);
  expect(backgroundBehind(screen.getByText('Cálculo I'))).toBe(
    DARK.colors.background,
  );

  // no claro a faixa não existe (superfície e fundo são o mesmo branco)
  await renderWithProviders(screenContent);
  expect(backgroundBehind(screen.getByText('P1'))).toBe(
    LIGHT.colors.background,
  );
});

it('shows the error screen in the scheme the app is using', async () => {
  jest.mocked(useColorScheme).mockReturnValue('dark');
  const Broken = () => {
    throw new Error('Falha de renderização de teste');
  };
  const consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  await render(
    <ErrorBoundary>
      <Broken />
    </ErrorBoundary>,
  );
  consoleError.mockRestore();
  expect(backgroundBehind(screen.getByText('Oops! Algo deu errado'))).toBe(
    DARK.colors.background,
  );
  expect(screen.getByText('Oops! Algo deu errado')).toHaveStyle({
    color: DARK.colors.ink,
  });
});
