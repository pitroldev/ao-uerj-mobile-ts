import { IdentityController } from '../IdentityController';
import type {
  Credentials,
  SavedAccount,
  StudentProfile,
} from '../../domain/types';
import type {
  AuthenticationPort,
  CredentialStore,
  AccountDataLifecycle,
} from '../ports';
import {
  AppError,
  errorMessage,
  type ErrorCode,
} from '@root/shared/errors/AppError';

const profile: StudentProfile = {
  matricula: 'test-student',
  name: 'Estudante fictício',
  period: '2026.2',
};
const credentials = {
  matricula: profile.matricula,
  password: 'synthetic-password',
};
const saved: SavedAccount = {
  credentials,
  account: { ...profile, scope: 'scope-a' },
};

function create(savedAccount: SavedAccount | null = null) {
  let value = savedAccount;
  const vault: jest.Mocked<CredentialStore> = {
    read: jest.fn(async () => value),
    write: jest.fn(async next => {
      value = next;
    }),
    clear: jest.fn(async () => {
      value = null;
    }),
  };
  const auth: jest.Mocked<AuthenticationPort> = {
    signIn: jest.fn<Promise<StudentProfile>, [Credentials]>(
      async () => profile,
    ),
    refresh: jest.fn(async () => profile),
    signOut: jest.fn(async () => {}),
  };
  const data: jest.Mocked<AccountDataLifecycle> = {
    activate: jest.fn<Promise<void>, [string]>(async () => {}),
    clear: jest.fn<Promise<void>, [string | null]>(async () => {}),
  };
  const identity = new IdentityController({
    authentication: auth,
    credentials: vault,
    accountData: data,
    createScope: () => 'scope-new',
  });
  return { identity, auth, vault, data, stored: () => value };
}

it('publishes only public profile after verified authentication and secure persistence', async () => {
  const { identity, stored, data } = create();
  await identity.signIn(credentials);
  expect(identity.getSnapshot()).toEqual({
    status: 'signedIn',
    account: { ...profile, scope: 'scope-new' },
    error: null,
  });
  expect(JSON.stringify(identity.getSnapshot())).not.toContain(
    credentials.password,
  );
  expect(stored()?.credentials).toEqual(credentials);
  expect(data.activate).toHaveBeenCalledWith('scope-new');
});

it('logout clears credentials and account data', async () => {
  const { identity, stored, data } = create(saved);
  await identity.restore();
  await identity.signOut();
  expect(stored()).toBeNull();
  expect(identity.getSnapshot().account).toBeNull();
  expect(data.clear).toHaveBeenCalledWith('scope-a');
});

it('discards a sign-in result that arrives after logout', async () => {
  const { identity, auth, stored } = create();
  let resolve!: (value: StudentProfile) => void;
  let started!: () => void;
  const reached = new Promise<void>(yes => {
    started = yes;
  });
  auth.signIn.mockImplementationOnce(() => {
    started();
    return new Promise(yes => {
      resolve = yes;
    });
  });
  const login = identity.signIn(credentials).catch(error => error);
  await reached;
  const logout = identity.signOut();
  expect(identity.getSnapshot().status).toBe('signedOut');
  resolve(profile);
  expect(await login).toMatchObject({ code: 'CANCELLED' });
  await logout;
  expect(stored()).toBeNull();
  expect(identity.getSnapshot().account).toBeNull();
});

it('waits for an in-progress vault write before removing the old credential', async () => {
  const { identity, vault, stored } = create();
  let finish!: () => void;
  let started!: () => void;
  const reached = new Promise<void>(yes => {
    started = yes;
  });
  const write = vault.write.getMockImplementation()!;
  vault.write.mockImplementationOnce(async account => {
    started();
    await new Promise<void>(yes => {
      finish = yes;
    });
    await write(account);
  });
  const login = identity.signIn(credentials).catch(error => error);
  await reached;
  const logout = identity.signOut();
  finish();
  await login;
  await logout;
  expect(stored()).toBeNull();
});

it('restores cached identity offline without deleting its saved access', async () => {
  const { identity, auth, stored, data } = create(saved);
  auth.signIn.mockRejectedValueOnce(new AppError('NETWORK'));
  await identity.restore();
  expect(identity.getSnapshot()).toMatchObject({
    status: 'signedIn',
    account: saved.account,
  });
  expect(data.activate).toHaveBeenCalledWith('scope-a');
  expect(stored()).toEqual(saved);
});

it('removes rejected saved credentials and cache', async () => {
  const { identity, auth, stored, data } = create(saved);
  auth.signIn.mockRejectedValueOnce(new AppError('LOGIN_FAILED'));
  await identity.restore();
  expect(identity.getSnapshot().status).toBe('signedOut');
  expect(stored()).toBeNull();
  expect(data.clear).toHaveBeenCalledWith('scope-a');
});

it.each<ErrorCode>([
  'SESSION_EXPIRED',
  'PORTAL_LAYOUT_CHANGED',
  'POSSIBLY_BLOCKED',
  // same portal warning for an unknown registration and for maintenance
  'ACCOUNT_UNAVAILABLE',
])(
  'keeps saved identity when cold restore encounters %s at the portal',
  async code => {
    const { identity, auth, vault, stored, data } = create(saved);
    auth.signIn.mockRejectedValueOnce(new AppError(code));
    await identity.restore();
    expect(identity.getSnapshot()).toMatchObject({
      status: 'signedIn',
      account: saved.account,
      error: errorMessage(new AppError(code)),
      // the background check records the outcome from the code
      errorCode: code,
    });
    expect(stored()).toEqual(saved);
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(vault.clear).not.toHaveBeenCalled();
    expect(data.clear).not.toHaveBeenCalled();
  },
);

it('does not restore an authenticated account when secure persistence fails', async () => {
  const { identity, vault, auth, stored, data } = create(saved);
  vault.write.mockRejectedValueOnce(new AppError('STORAGE_FAILED'));
  await identity.restore();
  expect(identity.getSnapshot().status).toBe('signedOut');
  expect(stored()).toBeNull();
  expect(auth.signOut).toHaveBeenCalledTimes(1);
  expect(data.clear).toHaveBeenCalledWith('scope-a');
});

it('does not publish sign-in if secure storage fails', async () => {
  const { identity, vault, stored } = create();
  vault.write.mockRejectedValueOnce(new AppError('STORAGE_FAILED'));
  await expect(identity.signIn(credentials)).rejects.toMatchObject({
    code: 'STORAGE_FAILED',
  });
  expect(identity.getSnapshot().status).toBe('signedOut');
  expect(stored()).toBeNull();
});

it('repairs a corrupted saved credential during an explicit sign-in', async () => {
  const { identity, vault, stored, auth } = create();
  vault.read.mockRejectedValueOnce(new AppError('STORAGE_FAILED'));
  await identity.signIn(credentials);
  expect(auth.signIn).toHaveBeenCalledWith(credentials);
  expect(stored()?.credentials).toEqual(credentials);
  expect(identity.getSnapshot().status).toBe('signedIn');
});

it('keeps the account scope stable during refresh', async () => {
  const { identity, auth, stored } = create(saved);
  await identity.restore();
  auth.refresh.mockResolvedValueOnce({ ...profile, period: '2027.1' });
  const first = identity.refresh();
  expect(identity.refresh()).toBe(first);
  await first;
  expect(stored()?.account).toEqual({
    ...profile,
    period: '2027.1',
    scope: 'scope-a',
  });
});

it.each<ErrorCode>([
  'SESSION_EXPIRED',
  'SESSION_CHANGED',
  'PORTAL_LAYOUT_CHANGED',
  'POSSIBLY_BLOCKED',
  'ACCOUNT_UNAVAILABLE',
  'NETWORK',
  'SERVICE_UNAVAILABLE',
  'RATE_LIMITED',
  'CANCELLED',
  'STORAGE_FAILED',
])(
  'preserves verified identity and saved access when refresh fails with %s',
  async code => {
    const { identity, auth, vault, stored, data } = create(saved);
    await identity.restore();
    auth.refresh.mockRejectedValueOnce(new AppError(code));
    await identity.refresh();
    expect(identity.getSnapshot()).toMatchObject({
      status: 'signedIn',
      account: saved.account,
      error: errorMessage(new AppError(code)),
      errorCode: code,
    });
    expect(stored()).toEqual(saved);
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(vault.clear).not.toHaveBeenCalled();
    expect(data.clear).not.toHaveBeenCalled();
    // A later retry is allowed to repair the protocol without explicit sign-in.
    await identity.refresh();
    expect(identity.getSnapshot().error).toBeNull();
    expect(identity.getSnapshot().errorCode).toBeUndefined();
  },
);

it.each<ErrorCode>(['LOGIN_FAILED', 'NOT_LOGGED_IN'])(
  'clears access only for terminal authentication failure %s during refresh',
  async code => {
    const { identity, auth, stored, data } = create(saved);
    await identity.restore();
    auth.refresh.mockRejectedValueOnce(new AppError(code));
    await identity.refresh();
    expect(identity.getSnapshot().status).toBe('signedOut');
    expect(stored()).toBeNull();
    expect(data.clear).toHaveBeenCalledWith('scope-a');
  },
);

it('discards late refresh after logout', async () => {
  const { identity, auth, stored } = create(saved);
  await identity.restore();
  let finish!: (value: StudentProfile) => void;
  auth.refresh.mockImplementationOnce(
    () =>
      new Promise(yes => {
        finish = yes;
      }),
  );
  const pending = identity.refresh();
  await identity.signOut();
  finish(profile);
  await pending;
  expect(identity.getSnapshot().status).toBe('signedOut');
  expect(stored()).toBeNull();
});
