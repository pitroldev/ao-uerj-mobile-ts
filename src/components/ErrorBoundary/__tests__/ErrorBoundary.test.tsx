import React from 'react';
import { Text } from 'react-native';
import { render, screen, userEvent } from '@testing-library/react-native';
import * as Sentry from '@sentry/react-native';
import BootSplash from 'react-native-bootsplash';
import { startObservability } from '@root/app/observability/sentry';
import { ErrorBoundary } from '../ErrorBoundary';

let consoleError: jest.SpyInstance;

beforeEach(() => {
  consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
});

afterEach(() => {
  consoleError.mockRestore();
});

it('renders and recovers from a child failure without any theme or app provider', async () => {
  let fail = true;
  const Child = () => {
    if (fail) throw new Error('Falha de renderização de teste');
    return <Text>Aplicativo recuperado</Text>;
  };
  // sem `renderWithProviders`: a tela de erro fica fora dos provedores do app
  await render(
    <ErrorBoundary>
      <Child />
    </ErrorBoundary>,
  );
  expect(screen.getByText('Oops! Algo deu errado')).toBeOnTheScreen();
  // a falha pode vir antes do onReady da navegação, com o splash ainda visível
  expect(BootSplash.hide).toHaveBeenCalledWith({ fade: true });
  const retry = screen.getByRole('button', { name: 'Tentar novamente' });
  fail = false;
  await userEvent.setup().press(retry);
  expect(screen.getByText('Aplicativo recuperado')).toBeOnTheScreen();
  expect(screen.queryByText('Oops! Algo deu errado')).not.toBeOnTheScreen();
});

it('sends the caught error with its component stack', async () => {
  // mesmo módulo que o ErrorBoundary usa, com o SDK simulado em jest/setup-sentry.js
  startObservability({
    dsn: 'https://chave@o1.ingest.de.sentry.io/1',
    isDev: false,
  });
  const failure = new Error('Falha de renderização de teste');
  const BrokenScreen = () => {
    throw failure;
  };
  await render(
    <ErrorBoundary>
      <BrokenScreen />
    </ErrorBoundary>,
  );
  expect(screen.getByText('Oops! Algo deu errado')).toBeOnTheScreen();
  expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  expect(Sentry.captureException).toHaveBeenCalledWith(failure, {
    mechanism: { type: 'react.errorboundary', handled: true },
    captureContext: {
      contexts: {
        react: { componentStack: expect.stringContaining('BrokenScreen') },
      },
    },
  });
});
