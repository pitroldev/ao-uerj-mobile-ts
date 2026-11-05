import { AppState, Platform } from 'react-native';

import type { SecureVault } from '@root/adapters/outbound/persistence/vault-storage';
import type { PrivateApiHttpClient } from '@root/adapters/outbound/private-api';
import type { IdentityState } from '@root/modules/identity/domain/types';
import { testCrypto } from '@root/modules/trust/__tests__/testCrypto';
import { toBase64 } from '@root/modules/trust/domain/bytes';
import type { Spec as AppAttestSpec } from '@root/specs/NativeAppAttest';
import type { Spec as DeviceTrustSpec } from '@root/specs/NativeDeviceTrust';
import {
  createDeviceTrust,
  createStudentSession,
  followIdentity,
} from '../createStudentSession';

// os dois módulos nativos ausentes, até um teste pôr um deles
let mockAppAttest: jest.Mocked<AppAttestSpec> | null = null;
let mockDeviceTrust: jest.Mocked<DeviceTrustSpec> | null = null;
jest.mock('@root/specs/NativeAppAttest', () => ({
  __esModule: true,
  get default() {
    return mockAppAttest;
  },
}));
jest.mock('@root/specs/NativeDeviceTrust', () => ({
  __esModule: true,
  get default() {
    return mockDeviceTrust;
  },
}));

const crypto = {
  randomBytes: jest.fn((length: number) =>
    toBase64(testCrypto.randomBytes(length)),
  ),
  digest: jest.fn(() => toBase64(new Uint8Array(32))),
};

function appAttestModule(supported = true) {
  return {
    ...crypto,
    isSupported: jest.fn(() => supported),
    attest: jest.fn(async () => ({ keyId: 'key', attestation: 'cbor' })),
  } as unknown as jest.Mocked<AppAttestSpec>;
}

function playModule() {
  return {
    ...crypto,
    requestToken: jest.fn(async () => 'play-token'),
  } as unknown as jest.Mocked<DeviceTrustSpec>;
}

const ACCOUNT = {
  scope: 's',
  matricula: '209912345678',
  name: 'Marina',
  period: '2026.2',
};

function identity() {
  let state: IdentityState = {
    status: 'restoring',
    account: null,
    error: null,
  };
  const listeners = new Set<() => void>();
  const publish = (next: IdentityState) => {
    state = next;
    listeners.forEach(listener => listener());
  };
  return {
    controller: {
      getSnapshot: () => state,
      subscribe: jest.fn((listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }),
    },
    signIn: (error: string | null = null) =>
      publish({ status: 'signedIn', account: ACCOUNT, error }),
    signOut: () => publish({ status: 'signedOut', account: null, error: null }),
  };
}

function fakeSession() {
  return {
    supported: true,
    token: jest.fn(async () => 'token'),
    current: jest.fn(async (): Promise<string | null> => 'leaving'),
    clear: jest.fn(async (_token: string | null) => undefined),
  };
}

// o mock do React Native troca `currentState` por uma função; aqui ele volta
// a ser o texto do estado, como no aparelho
const appStateMock = AppState as unknown as { currentState: unknown };
const originalState = appStateMock.currentState;

beforeEach(() => {
  jest.useFakeTimers();
  appStateMock.currentState = 'active';
});

afterEach(() => {
  jest.useRealTimers();
  appStateMock.currentState = originalState;
  mockAppAttest = null;
  mockDeviceTrust = null;
});

it('attests with App Attest on the iPhone and with Play Integrity on Android', async () => {
  mockAppAttest = appAttestModule();
  mockDeviceTrust = playModule();
  const hash = 'ab'.repeat(32);
  await expect(createDeviceTrust('ios')?.attest(hash)).resolves.toEqual({
    appAttest: { keyId: 'key', attestation: 'cbor' },
  });
  expect(mockDeviceTrust.requestToken).not.toHaveBeenCalled();
  await expect(createDeviceTrust('android')?.attest(hash)).resolves.toEqual({
    token: 'play-token',
  });
  expect(mockAppAttest.attest).toHaveBeenCalledTimes(1);

  // sem dizer a plataforma, vale a do aparelho (o Jest roda como iOS)
  expect(Platform.OS).toBe('ios');
  const session = createStudentSession({
    vault: {} as SecureVault,
    client: {} as PrivateApiHttpClient,
    account: () => null,
  });
  expect(session.supported).toBe(true);
});

it('does not sign in on the iPhone simulator, which has no App Attest', () => {
  mockAppAttest = appAttestModule(false);
  // o módulo da Play nunca vale no iPhone
  mockDeviceTrust = playModule();
  expect(createDeviceTrust('ios')).toBeNull();
  expect(
    createStudentSession({
      vault: {} as SecureVault,
      client: {} as PrivateApiHttpClient,
      account: () => null,
    }).supported,
  ).toBe(false);
  // e o do App Attest, nunca no Android
  mockAppAttest = appAttestModule();
  mockDeviceTrust = null;
  expect(createDeviceTrust('android')).toBeNull();
});

it('needs the attestation and the vault (none without the native module)', () => {
  const client = {} as PrivateApiHttpClient;
  expect(
    createStudentSession({ vault: null, client, account: () => null })
      .supported,
  ).toBe(false);
  expect(
    createStudentSession({
      vault: {} as SecureVault,
      client,
      account: () => null,
    }).supported,
  ).toBe(false);
  expect(
    createStudentSession({
      vault: {} as SecureVault,
      client,
      account: () => null,
      device: { crypto: testCrypto, attest: async () => ({ token: 't' }) },
    }).supported,
  ).toBe(true);
});

it('signs in a while after the confirmed login, with the app in front', async () => {
  const people = identity();
  const session = fakeSession();
  followIdentity(session, people.controller, { random: () => 0 });

  people.signIn('falha do portal');
  jest.advanceTimersByTime(60_000);
  expect(session.token).not.toHaveBeenCalled();

  people.signIn();
  jest.advanceTimersByTime(4_999);
  expect(session.token).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(session.token).toHaveBeenCalledTimes(1);

  // em segundo plano, não entra
  appStateMock.currentState = 'background';
  people.signIn();
  jest.advanceTimersByTime(60_000);
  expect(session.token).toHaveBeenCalledTimes(1);
});

it('leaves the tables and groups first, then ends the session on logout', async () => {
  jest.useRealTimers();
  const people = identity();
  const session = fakeSession();
  const order: string[] = [];
  session.clear.mockImplementation(async () => {
    order.push('session');
  });
  followIdentity(session, people.controller, {
    beforeClear: async () => {
      await new Promise(resolve => setTimeout(() => resolve(null), 5));
      order.push('companion');
    },
  });
  people.signIn();
  people.signOut();
  // a sessão de quem saiu é guardada na hora, antes de sair das mesas
  expect(session.current).toHaveBeenCalledTimes(1);
  session.current.mockResolvedValue('next-account');
  await new Promise(resolve => setTimeout(() => resolve(null), 20));
  expect(order).toEqual(['companion', 'session']);
  expect(session.clear).toHaveBeenCalledWith('leaving');
  // um segundo signedOut não repete
  people.signOut();
  await new Promise(resolve => setTimeout(() => resolve(null), 20));
  expect(session.clear).toHaveBeenCalledTimes(1);
});

it('still ends the session when leaving the tables fails', async () => {
  jest.useRealTimers();
  const people = identity();
  const session = fakeSession();
  followIdentity(session, people.controller, {
    beforeClear: async () => {
      throw new Error('offline');
    },
  });
  people.signIn();
  people.signOut();
  await new Promise(resolve => setTimeout(() => resolve(null), 10));
  expect(session.clear).toHaveBeenCalledTimes(1);
  expect(session.clear).toHaveBeenCalledWith('leaving');
});
