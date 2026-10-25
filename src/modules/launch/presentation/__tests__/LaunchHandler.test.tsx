import React from 'react';
import { act, render } from '@testing-library/react-native';

import type { LaunchSource } from '../../application/ports';
import type { LaunchTarget } from '../../domain/launchTarget';
import { LaunchHandler } from '../LaunchHandler';

const mockNavigate = jest.fn();
let mockStatus = 'restoring';
/** Conta salva já lida (na abertura, antes do login no portal). */
let mockSavedAccount = false;
let mockLaunches: LaunchSource | null = null;
jest.mock('@services/rootNavigation', () => ({
  navigate: (...args: unknown[]) => mockNavigate(...args),
}));
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useIdentity: () => ({
    status: mockStatus,
    account:
      mockStatus === 'signedIn' ||
      mockStatus === 'refreshing' ||
      (mockStatus === 'restoring' && mockSavedAccount)
        ? { scope: 'account-a' }
        : null,
  }),
  useAppServices: () => ({ launches: mockLaunches }),
}));

function launches(initial: LaunchTarget | null) {
  let listener: ((target: LaunchTarget) => void) | null = null;
  return {
    consume: jest.fn(async () => initial),
    subscribe: jest.fn((next: (target: LaunchTarget) => void) => {
      listener = next;
      return () => {
        listener = null;
      };
    }),
    emit: (target: LaunchTarget) => listener?.(target),
  };
}

beforeEach(() => {
  mockStatus = 'restoring';
  mockSavedAccount = false;
});

it('waits for the account and the navigation before opening the screen', async () => {
  mockLaunches = launches('documents');
  const view = await render(<LaunchHandler ready={false} />);
  await act(async () => undefined);
  expect(mockNavigate).not.toHaveBeenCalled();

  await view.rerender(<LaunchHandler ready />);
  await act(async () => undefined);
  expect(mockNavigate).not.toHaveBeenCalled();

  mockStatus = 'signedIn';
  await view.rerender(<LaunchHandler ready />);
  await act(async () => undefined);
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith('Emissão de Documentos');
});

it('opens the screen with the saved account before the opening sign-in ends', async () => {
  mockSavedAccount = true;
  mockLaunches = launches('documents');
  await render(<LaunchHandler ready />);
  await act(async () => undefined);
  expect(mockNavigate).toHaveBeenCalledWith('Emissão de Documentos');
});

it('opens the screen of a later launch with the app open', async () => {
  mockStatus = 'signedIn';
  const source = launches(null);
  mockLaunches = source;
  await render(<LaunchHandler ready />);
  await act(async () => undefined);
  await act(() => source.emit('home'));
  expect(mockNavigate).toHaveBeenCalledWith('Início');
});

it('opens the grades on Início, focused on them', async () => {
  mockStatus = 'signedIn';
  mockLaunches = launches('grades');
  await render(<LaunchHandler ready />);
  await act(async () => undefined);
  expect(mockNavigate).toHaveBeenCalledWith('Início', { focus: 'grades' });
});

it('opens the map without an account, and the rest only after the login', async () => {
  mockStatus = 'signedOut';
  const source = launches('map');
  mockLaunches = source;
  const view = await render(<LaunchHandler ready />);
  await act(async () => undefined);
  expect(mockNavigate).toHaveBeenCalledWith('Mapa');

  await act(() => source.emit('documents'));
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  mockStatus = 'signedIn';
  await view.rerender(<LaunchHandler ready />);
  await act(async () => undefined);
  expect(mockNavigate).toHaveBeenLastCalledWith('Emissão de Documentos');
});

it('does nothing without the native module', async () => {
  mockStatus = 'signedIn';
  mockLaunches = null;
  await render(<LaunchHandler ready />);
  await act(async () => undefined);
  expect(mockNavigate).not.toHaveBeenCalled();
});
