import React from 'react';
import { AppState, Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { act, render, screen } from '@testing-library/react-native';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { snackbar } from '@components/ui/Snackbar';
import { AppServicesProvider } from '../AppServicesProvider';
import type { AppServices } from '../../composition/createAppServices';
import { PortalMonitor } from '@root/modules/connectivity/application/PortalMonitor';
import { useNetworkStatus } from '@root/modules/connectivity/presentation/networkStatus';
import type { IdentityState } from '@root/modules/identity/domain/types';

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

function NetworkStatusProbe() {
  return <Text testID="network-status">{useNetworkStatus()}</Text>;
}

/** Os serviços que o provedor usa, com o monitor do portal de verdade. */
function servicesWith(overrides: Record<string, unknown>) {
  let status = 200;
  const portalMonitor = new PortalMonitor({
    now: Date.now,
    online: () => true,
    active: () => true,
    probe: async () => status,
    setTimer: () => null,
    clearTimer: () => undefined,
  });
  let identityState: IdentityState = {
    status: 'signedOut',
    account: null,
    error: null,
  };
  const identityListeners = new Set<() => void>();
  return {
    services: {
      initialize: jest.fn(async () => null),
      flushCache: jest.fn(async () => {}),
      portalMonitor,
      queryClient: { refetchQueries: jest.fn(async () => {}) },
      notifications: { portalReturn: null },
      ...overrides,
      identity: {
        refresh: jest.fn(async () => {}),
        subscribe: (listener: () => void) => {
          identityListeners.add(listener);
          return () => {
            identityListeners.delete(listener);
          };
        },
        getSnapshot: () => identityState,
      },
    } as unknown as AppServices,
    setProbeStatus: (next: number) => {
      status = next;
    },
    publishIdentity: (next: IdentityState) => {
      identityState = next;
      identityListeners.forEach(listener => listener());
    },
  };
}

it('resumes query focus without forcing login and flushes the cache on background', async () => {
  const remove = jest.fn();
  const listener = jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove });
  const { services } = servicesWith({});
  await render(
    <AppServicesProvider services={services}>
      <></>
    </AppServicesProvider>,
  );
  const stateChange = listener.mock.calls[0][1];
  await act(() => {
    stateChange('background');
    stateChange('active');
    stateChange('active');
  });
  expect(services.identity.refresh).not.toHaveBeenCalled();
  expect(services.flushCache).toHaveBeenCalledTimes(1);
  expect(focusManager.isFocused()).toBe(true);
  const networkChange = jest.mocked(NetInfo.addEventListener).mock.calls[0][0];
  networkChange({ isConnected: false } as Parameters<typeof networkChange>[0]);
  expect(onlineManager.isOnline()).toBe(false);
  networkChange({ isConnected: true, isInternetReachable: true } as Parameters<
    typeof networkChange
  >[0]);
  expect(onlineManager.isOnline()).toBe(true);
  await screen.unmount();
  expect(remove).toHaveBeenCalledTimes(1);
  listener.mockRestore();
});

it('reports the startup warning with an error snackbar', async () => {
  const showError = jest.spyOn(snackbar, 'error');
  const listener = jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() });
  const { services } = servicesWith({
    initialize: jest.fn(async () => 'Não foi possível restaurar o cache.'),
  });
  await render(
    <AppServicesProvider services={services}>
      <></>
    </AppServicesProvider>,
  );
  expect(showError).toHaveBeenCalledWith('Não foi possível restaurar o cache.');
  listener.mockRestore();
});

it('updates the failed screens and says so when the portal comes back', async () => {
  const showSuccess = jest.spyOn(snackbar, 'success');
  const listener = jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() });
  const { services, setProbeStatus } = servicesWith({});
  await render(
    <AppServicesProvider services={services}>
      <></>
    </AppServicesProvider>,
  );
  await act(() => {
    focusManager.setFocused(true);
    setProbeStatus(503);
    services.portalMonitor.failed('unavailable');
  });
  expect(services.portalMonitor.getSnapshot().state).toBe('down');
  setProbeStatus(200);
  await act(() => services.portalMonitor.retryNow());
  expect(showSuccess).toHaveBeenCalledWith(
    'O Aluno Online voltou.',
    'Atualizando seus dados…',
  );
  expect(services.queryClient.refetchQueries).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'active' }),
  );
  listener.mockRestore();
});

it('tracks unvalidated Wi-Fi, enables demo queries offline and promotes verified campus sessions', async () => {
  jest.clearAllMocks();
  const listener = jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() });
  const { services, publishIdentity } = servicesWith({});
  publishIdentity({ status: 'signedOut', account: null, error: null });

  await render(
    <AppServicesProvider services={services}>
      <NetworkStatusProbe />
    </AppServicesProvider>,
  );
  const networkChange = jest.mocked(NetInfo.addEventListener).mock.calls[0][0];

  await act(() => {
    networkChange({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: false,
    } as Parameters<typeof networkChange>[0]);
  });
  expect(screen.getByTestId('network-status')).toHaveTextContent(
    'unvalidated_wifi',
  );
  expect(onlineManager.isOnline()).toBe(false);

  // A conta de demonstração libera as consultas locais mesmo sem internet
  // validada, mas não marca o Wi-Fi como autenticado depois do logout.
  await act(() => {
    publishIdentity({
      status: 'signedIn',
      account: {
        scope: 'demo',
        matricula: '123456',
        name: 'Demo',
        period: '2026.2',
        demo: true,
      },
      error: null,
    });
  });
  expect(onlineManager.isOnline()).toBe(true);
  expect(screen.getByTestId('network-status')).toHaveTextContent(
    'unvalidated_wifi',
  );

  await act(() => {
    publishIdentity({ status: 'signedOut', account: null, error: null });
  });
  expect(onlineManager.isOnline()).toBe(false);
  expect(screen.getByTestId('network-status')).toHaveTextContent(
    'unvalidated_wifi',
  );

  // Um login real concluído prova que o Aluno Online responde neste Wi-Fi.
  await act(() => {
    publishIdentity({
      status: 'signedIn',
      account: {
        scope: 'student',
        matricula: '2023100',
        name: 'Aluna',
        period: '2026.2',
      },
      error: null,
    });
  });
  expect(onlineManager.isOnline()).toBe(true);
  expect(screen.getByTestId('network-status')).toHaveTextContent('online');

  await screen.unmount();
  onlineManager.setOnline(true);
  listener.mockRestore();
});
