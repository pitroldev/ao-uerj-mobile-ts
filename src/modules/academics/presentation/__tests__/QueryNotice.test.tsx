import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import { PortalMonitor } from '@root/modules/connectivity/application/PortalMonitor';
import { PortalStatusProvider } from '@root/modules/connectivity/presentation/PortalStatusContext';
import type { PortalReturnAlert } from '@root/modules/notifications/application/PortalReturnAlert';
import type { IdentityState } from '@root/modules/identity/domain/types';
import { AppError } from '@root/shared/errors/AppError';
import { renderWithProviders } from '@root/test-utils/render';
import { QueryNotice } from '../QueryNotice';

const START = new Date(2026, 9, 22, 14, 5).getTime();
const ACCOUNT = {
  scope: 'account-a',
  name: 'Estudante',
  matricula: '1',
  period: '2026.2',
};

function setup({
  identity = { status: 'signedIn', account: ACCOUNT, error: null },
  alert = null as PortalReturnAlert | null,
}: { identity?: IdentityState; alert?: PortalReturnAlert | null } = {}) {
  const probe = jest.fn(async () => 503);
  const monitor = new PortalMonitor({
    now: () => START,
    online: () => true,
    active: () => true,
    probe,
    setTimer: () => null,
    clearTimer: () => undefined,
  });
  const render = (notice: React.ReactElement) =>
    renderWithProviders(
      <PortalStatusProvider
        monitor={monitor}
        identity={{
          subscribe: () => () => undefined,
          getSnapshot: () => identity,
        }}
        alert={alert}
      >
        {notice}
      </PortalStatusProvider>,
    );
  return { monitor, probe, render };
}

const notice = (
  props: Partial<React.ComponentProps<typeof QueryNotice>> = {},
) => (
  <QueryNotice
    isPaused={false}
    isFetching={false}
    hasData
    error={null}
    retry={() => undefined}
    {...props}
  />
);

beforeEach(() => {
  onlineManager.setOnline(true);
});

it('says the portal is not answering, keeps the data and offers to retry now', async () => {
  const { monitor, probe, render } = setup();
  await render(notice({ error: new AppError('SERVICE_UNAVAILABLE') }));
  await act(() => monitor.failed('unavailable'));
  const alert = screen.getByRole('alert');
  expect(alert).toHaveTextContent(
    /^O Aluno Online não está respondendo desde 14:05\. Nova tentativa às 14:06\. Exibindo os últimos dados salvos\./,
  );
  expect(
    screen.queryByText(/Não foi possível atualizar/),
  ).not.toBeOnTheScreen();
  // sem avisos nativos (iOS), sem "Avisar quando voltar"
  expect(
    screen.queryByRole('button', {
      name: 'Avisar quando o Aluno Online voltar',
    }),
  ).not.toBeOnTheScreen();
  const before = probe.mock.calls.length;
  await fireEvent.press(screen.getByRole('button', { name: 'Tentar agora' }));
  expect(probe.mock.calls.length).toBe(before + 1);
});

it('offers the notice of when the portal comes back, where there are notifications', async () => {
  const request = jest.fn(async () => 'requested' as const);
  const snapshot = { scope: null, requested: false };
  const alert = {
    subscribe: () => () => undefined,
    getSnapshot: () => snapshot,
    load: jest.fn(async () => undefined),
    request,
    cancel: jest.fn(async () => undefined),
  } as unknown as PortalReturnAlert;
  const { monitor, render } = setup({ alert });
  await render(notice());
  await act(() => monitor.failed('unavailable'));
  await fireEvent.press(
    screen.getByRole('button', { name: 'Avisar quando o Aluno Online voltar' }),
  );
  expect(request).toHaveBeenCalledTimes(1);
});

it('leaves the portal out of the notice of our own API', async () => {
  const { monitor, render } = setup();
  await render(notice({ portal: false, error: new AppError('NETWORK') }));
  await act(() => monitor.failed('unavailable'));
  expect(screen.getByText(/^Não foi possível atualizar/)).toBeOnTheScreen();
});

it('shows the opening sign-in with the saved data on screen', async () => {
  const { render } = setup({
    identity: { status: 'restoring', account: ACCOUNT, error: null },
  });
  await render(notice());
  expect(screen.getByLabelText('Entrando no Aluno Online…')).toBeOnTheScreen();
});

it('says the portal is slow while it updates', async () => {
  const { monitor, render } = setup();
  await render(notice({ isFetching: true }));
  expect(screen.getByLabelText('Atualizando dados…')).toBeOnTheScreen();
  await act(() => monitor.answered(200, 9000));
  expect(
    screen.getByLabelText('O Aluno Online está lento. Atualizando…'),
  ).toBeOnTheScreen();
});
