import { AppState } from 'react-native';

import type { SecureVault } from '@root/adapters/outbound/persistence/vault-storage';
import type { PrivateApiHttpClient } from '@root/adapters/outbound/private-api';
import type { RemoteStatus } from '@root/modules/delivery/application/RemoteStatus';
import type { IdentityState } from '@root/modules/identity/domain/types';
import { testCrypto } from '@root/modules/trust/__tests__/testCrypto';
import { PrivateTokens } from '@root/modules/trust/application/PrivateTokens';
import type { DeviceTrustPort } from '@root/modules/trust/application/ports';
import { createTrust } from '../createTrust';

jest.mock('@root/specs/NativeDeviceTrust', () => ({
  __esModule: true,
  default: null,
}));

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

const vault = {} as SecureVault;
const client = {} as PrivateApiHttpClient;
const device: DeviceTrustPort = {
  crypto: testCrypto,
  attest: async () => ({ token: 'integrity' }),
};
const remoteStatus = {
  getSnapshot: () => ({ status: null, dismissed: new Set<string>() }),
} as unknown as RemoteStatus;

// o mock do React Native troca `currentState` por uma função; aqui ele volta
// a ser o texto do estado, como no aparelho
const appStateMock = AppState as unknown as { currentState: unknown };
const originalState = appStateMock.currentState;

let refill: jest.SpyInstance;
let clear: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  appStateMock.currentState = 'active';
  refill = jest
    .spyOn(PrivateTokens.prototype, 'refill')
    .mockResolvedValue('refilled');
  clear = jest.spyOn(PrivateTokens.prototype, 'clear').mockResolvedValue();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  appStateMock.currentState = originalState;
});

function setup(
  options: { device?: DeviceTrustPort | null; vault?: SecureVault | null } = {},
) {
  const account = identity();
  const tokens = createTrust({
    identity: account.controller,
    remoteStatus,
    vault: options.vault === undefined ? vault : options.vault,
    client,
    device: options.device === undefined ? device : options.device,
    random: () => 0.5,
  });
  return { account, tokens };
}

it('asks for tokens a random while after a sign-in confirmed in the portal', () => {
  const { account } = setup();
  account.signIn();
  // 20 s + metade de 100 s
  jest.advanceTimersByTime(69_999);
  expect(refill).not.toHaveBeenCalled();
  // a identidade publica de novo (atualização): uma espera só
  account.signIn();
  jest.advanceTimersByTime(1);
  expect(refill).toHaveBeenCalledTimes(1);
});

it('does not ask with an unconfirmed session or with the app in the background', () => {
  const { account } = setup();
  account.signIn('Verifique sua conexão e tente novamente.');
  jest.advanceTimersByTime(200_000);
  appStateMock.currentState = 'background';
  account.signIn();
  jest.advanceTimersByTime(200_000);
  expect(refill).not.toHaveBeenCalled();
});

it('clears the stock on the logout and drops a pending request', () => {
  const { account } = setup();
  account.signIn();
  account.signOut();
  expect(clear).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(200_000);
  expect(refill).not.toHaveBeenCalled();
  // já sem conta, outra publicação não apaga de novo
  account.signOut();
  expect(clear).toHaveBeenCalledTimes(1);
});

it('does not follow the account where there is no attestation or vault', () => {
  for (const options of [{ device: null }, { vault: null }]) {
    const { account, tokens } = setup(options);
    expect(tokens).toBeInstanceOf(PrivateTokens);
    expect(account.controller.subscribe).not.toHaveBeenCalled();
  }
});
