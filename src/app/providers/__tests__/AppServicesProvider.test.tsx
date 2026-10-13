import React from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { act, render, screen } from '@testing-library/react-native';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { snackbar } from '@components/ui/Snackbar';
import { AppServicesProvider } from '../AppServicesProvider';
import type { AppServices } from '../../composition/createAppServices';

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

it('resumes query focus without forcing login and flushes the cache on background', async () => {
  const remove = jest.fn();
  const listener = jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove });
  const services = {
    initialize: jest.fn(async () => null),
    flushCache: jest.fn(async () => {}),
    identity: { refresh: jest.fn(async () => {}) },
  } as unknown as AppServices;
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
  const services = {
    initialize: jest.fn(async () => 'Não foi possível restaurar o cache.'),
    flushCache: jest.fn(async () => {}),
  } as unknown as AppServices;
  await render(
    <AppServicesProvider services={services}>
      <></>
    </AppServicesProvider>,
  );
  expect(showError).toHaveBeenCalledWith('Não foi possível restaurar o cache.');
  listener.mockRestore();
});
