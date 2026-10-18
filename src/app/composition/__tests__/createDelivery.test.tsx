import { AppState, type AppStateStatus } from 'react-native';

import { createMemoryStore } from '@root/modules/delivery/application/__tests__/fakes';
import { REVIEW_HISTORY_KEY } from '@root/modules/delivery/application/ReviewPrompter';
import type { IdentityController } from '@root/modules/identity/application/IdentityController';
import type { PreferencesStore } from '@root/modules/identity/application/PreferencesStore';
import type { IdentityState } from '@root/modules/identity/domain/types';
import { createDelivery } from '../createDelivery';

jest.mock('react-native-in-app-review', () => ({
  __esModule: true,
  default: { isAvailable: () => false, RequestInAppReview: jest.fn() },
}));

/** Preferências globais sobre o armazenamento em memória dos testes de entrega. */
function preferences() {
  const store = createMemoryStore();
  const scoped = {
    read: (_scope: string, key: string) => store.read(key),
    write: (_scope: string, key: string, value: unknown) =>
      store.write(key, value),
    remove: jest.fn(async () => undefined),
  } as unknown as PreferencesStore;
  return { store, scoped };
}

function identity() {
  let state: IdentityState = {
    status: 'restoring',
    account: null,
    error: null,
  };
  const listeners = new Set<() => void>();
  return {
    controller: {
      getSnapshot: () => state,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    } as unknown as IdentityController,
    signIn() {
      state = {
        status: 'signedIn',
        account: {
          scope: 's',
          matricula: '1',
          name: 'Marina',
          period: '2026.2',
        },
        error: null,
      };
      listeners.forEach(listener => listener());
    },
  };
}

// o mock do React Native troca `currentState` por uma função; aqui ele volta
// a ser o texto do estado, como no aparelho
const appStateMock = AppState as unknown as { currentState: unknown };
const originalState = appStateMock.currentState;

function appState(initial: AppStateStatus) {
  let handler: ((state: AppStateStatus) => void) | null = null;
  appStateMock.currentState = initial;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, next) => {
    handler = next;
    return { remove: jest.fn() };
  });
  return (next: AppStateStatus) => {
    appStateMock.currentState = next;
    handler?.(next);
  };
}

const flush = () =>
  new Promise<void>(resolve => setTimeout(() => resolve(), 0));

afterEach(() => {
  appStateMock.currentState = originalState;
  jest.restoreAllMocks();
});

it('counts a session when the account loads with the app on screen', async () => {
  appState('active');
  const { store, scoped } = preferences();
  const account = identity();
  createDelivery({
    appVersion: '2.2.0',
    preferences: scoped,
    identity: account.controller,
  });
  account.signIn();
  await flush();
  expect(store.data.get(REVIEW_HISTORY_KEY)).toMatchObject({ sessions: 1 });
});

it('does not count the background check, only the next time the app comes to the front', async () => {
  const change = appState('background');
  const { store, scoped } = preferences();
  const account = identity();
  createDelivery({
    appVersion: '2.2.0',
    preferences: scoped,
    identity: account.controller,
  });
  account.signIn();
  await flush();
  expect(store.data.has(REVIEW_HISTORY_KEY)).toBe(false);

  change('active');
  await flush();
  expect(store.data.get(REVIEW_HISTORY_KEY)).toMatchObject({ sessions: 1 });
});
