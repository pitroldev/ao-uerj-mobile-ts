import React from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { AppServicesProvider } from '../AppServicesProvider';
import type { AppServices } from '../../composition/createAppServices';

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));
jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));

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
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <AppServicesProvider services={services}>
        <></>
      </AppServicesProvider>,
    );
  });
  const stateChange = listener.mock.calls[0][1];
  await act(async () => {
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
  await act(async () => renderer.unmount());
  expect(remove).toHaveBeenCalledTimes(1);
  listener.mockRestore();
});
