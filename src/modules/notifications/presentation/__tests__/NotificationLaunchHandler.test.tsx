import React from 'react';
import { act, render } from '@testing-library/react-native';

import type { NotificationLaunches } from '@root/adapters/outbound/native/NativeNotifications';
import type { NotificationTarget } from '../../domain/messages';
import { NotificationLaunchHandler } from '../NotificationLaunchHandler';

const mockNavigate = jest.fn();
let mockStatus = 'restoring';
let mockLaunches: NotificationLaunches | null = null;
jest.mock('@services/rootNavigation', () => ({
  navigate: (...args: unknown[]) => mockNavigate(...args),
}));
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useIdentity: () => ({ status: mockStatus }),
  useAppServices: () => ({ notifications: { launches: mockLaunches } }),
}));

function launches(initial: NotificationTarget | null) {
  let listener: ((target: NotificationTarget) => void) | null = null;
  return {
    consume: jest.fn(async () => initial),
    subscribe: jest.fn((next: (target: NotificationTarget) => void) => {
      listener = next;
      return () => {
        listener = null;
      };
    }),
    emit: (target: NotificationTarget) => listener?.(target),
  };
}

beforeEach(() => {
  mockStatus = 'restoring';
});

it('waits for the account and the navigation before opening the screen', async () => {
  const source = launches('documents');
  mockLaunches = source;
  const view = await render(<NotificationLaunchHandler ready={false} />);
  await act(async () => undefined);
  expect(mockNavigate).not.toHaveBeenCalled();

  await view.rerender(<NotificationLaunchHandler ready />);
  await act(async () => undefined);
  expect(mockNavigate).not.toHaveBeenCalled();

  mockStatus = 'signedIn';
  await view.rerender(<NotificationLaunchHandler ready />);
  await act(async () => undefined);
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith('Emissão de Documentos');
});

it('opens the screen of a notification tapped with the app open', async () => {
  mockStatus = 'signedIn';
  const source = launches(null);
  mockLaunches = source;
  await render(<NotificationLaunchHandler ready />);
  await act(async () => undefined);
  await act(() => source.emit('home'));
  expect(mockNavigate).toHaveBeenCalledWith('Início');
});

it('does nothing without the native module (iOS)', async () => {
  mockStatus = 'signedIn';
  mockLaunches = null;
  await render(<NotificationLaunchHandler ready />);
  await act(async () => undefined);
  expect(mockNavigate).not.toHaveBeenCalled();
});
