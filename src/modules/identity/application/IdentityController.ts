import { AppError, errorMessage } from '@root/shared/errors/AppError';
import type {
  Account,
  Credentials,
  IdentityState,
  SavedAccount,
  StudentProfile,
} from '../domain/types';
import type {
  AccountDataLifecycle,
  AuthenticationPort,
  CredentialStore,
} from './ports';

type Dependencies = {
  authentication: AuthenticationPort;
  credentials: CredentialStore;
  accountData: AccountDataLifecycle;
  createScope: () => string;
};

// Only these erase the saved access. ACCOUNT_UNAVAILABLE stays out: the portal
// uses the same warning for a maintenance window.
function isAccessRejected(error: unknown): boolean {
  return (
    error instanceof AppError &&
    ['LOGIN_FAILED', 'NOT_LOGGED_IN'].includes(error.code)
  );
}

/** Public identity has no cookie, portal request ID or password. */
export class IdentityController {
  private state: IdentityState = {
    status: 'restoring',
    account: null,
    error: null,
  };
  private listeners = new Set<() => void>();
  private epoch = 0;
  private transitions: Promise<unknown> = Promise.resolve();
  private restoration: Promise<void> | null = null;
  private refreshing: Promise<void> | null = null;

  constructor(private readonly dependencies: Dependencies) {}

  getSnapshot = (): IdentityState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(state: IdentityState) {
    this.state = state;
    this.listeners.forEach(listener => listener());
  }

  private assertCurrent(epoch: number) {
    if (epoch !== this.epoch) throw new AppError('CANCELLED');
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.transitions.then(operation, operation);
    this.transitions = pending.catch(() => undefined);
    return pending;
  }

  private account(
    profile: StudentProfile,
    saved: SavedAccount | null,
  ): Account {
    return {
      ...profile,
      scope:
        saved?.account.matricula === profile.matricula
          ? saved.account.scope
          : this.dependencies.createScope(),
    };
  }

  signIn = (credentials: Credentials): Promise<void> => {
    const epoch = ++this.epoch;
    const previousScope = this.state.account?.scope ?? null;
    this.publish({ status: 'signedOut', account: null, error: null });
    return this.enqueue(async () => {
      const {
        authentication,
        accountData,
        credentials: vault,
      } = this.dependencies;
      this.assertCurrent(epoch);
      try {
        // Explicit sign-in replaces the old record. A corrupt/obsolete vault
        // entry must not prevent the user from repairing access in one try.
        // clear/write below still enforce successful secure persistence.
        const saved = await vault.read().catch(() => null);
        this.assertCurrent(epoch);
        await authentication.signOut();
        await accountData.clear(previousScope ?? saved?.account.scope ?? null);
        await vault.clear();
        this.assertCurrent(epoch);
        const profile = await authentication.signIn(credentials);
        this.assertCurrent(epoch);
        const account = this.account(profile, saved);
        await vault.write({ credentials, account });
        this.assertCurrent(epoch);
        await accountData.activate(account.scope);
        this.assertCurrent(epoch);
        this.publish({ status: 'signedIn', account, error: null });
      } catch (error) {
        if (epoch === this.epoch) {
          await Promise.allSettled([
            authentication.signOut(),
            vault.clear(),
            accountData.clear(previousScope),
          ]);
          if (epoch === this.epoch)
            this.publish({
              status: 'signedOut',
              account: null,
              error: errorMessage(error),
            });
        }
        throw error;
      }
    });
  };

  restore = (): Promise<void> => {
    if (this.restoration) return this.restoration;
    const epoch = this.epoch;
    this.restoration = this.enqueue(async () => {
      const { credentials, authentication, accountData } = this.dependencies;
      try {
        const saved = await credentials.read();
        this.assertCurrent(epoch);
        if (!saved) {
          this.publish({ status: 'signedOut', account: null, error: null });
          return;
        }
        await accountData.activate(saved.account.scope);
        this.assertCurrent(epoch);
        let authenticated = false;
        try {
          const profile = await authentication.signIn(saved.credentials);
          this.assertCurrent(epoch);
          authenticated = true;
          const account = this.account(profile, saved);
          await credentials.write({ ...saved, account });
          this.assertCurrent(epoch);
          this.publish({ status: 'signedIn', account, error: null });
        } catch (error) {
          this.assertCurrent(epoch);
          // A portal/session failure does not invalidate a previously verified
          // credential. Secure persistence failures after authentication still
          // fail closed below, as they do during an explicit sign-in.
          if (!authenticated && !isAccessRejected(error)) {
            this.publish({
              status: 'signedIn',
              account: saved.account,
              error: errorMessage(error),
            });
            return;
          }
          await authentication.signOut();
          await credentials.clear();
          await accountData.clear(saved.account.scope);
          throw error;
        }
      } catch (error) {
        if (epoch === this.epoch) {
          this.publish({
            status: 'signedOut',
            account: null,
            error: errorMessage(error),
          });
        }
      }
    });
    return this.restoration;
  };

  signOut = (): Promise<void> => {
    const epoch = ++this.epoch;
    const scope = this.state.account?.scope ?? null;
    this.publish({ status: 'signedOut', account: null, error: null });
    // Cancel/drain transport immediately, even while a sign-in is pending.
    const draining = this.dependencies.authentication.signOut();
    // Observe immediately; cleanup below still reports the rejection.
    void draining.catch(() => undefined);
    return this.enqueue(async () => {
      const cleanup = await Promise.allSettled([
        draining,
        this.dependencies.credentials.clear(),
        this.dependencies.accountData.clear(scope),
      ]);
      const failed = cleanup.some(result => result.status === 'rejected');
      if (failed && epoch === this.epoch) {
        this.publish({
          status: 'signedOut',
          account: null,
          error: errorMessage(new AppError('STORAGE_FAILED')),
        });
        throw new AppError('STORAGE_FAILED');
      }
    });
  };

  refresh = (): Promise<void> => {
    if (this.refreshing) return this.refreshing;
    const { account } = this.state;
    if (!account) return Promise.resolve();
    const epoch = this.epoch;
    this.publish({ status: 'refreshing', account, error: null });
    this.refreshing = (async () => {
      try {
        const profile = await this.dependencies.authentication.refresh();
        this.assertCurrent(epoch);
        await this.enqueue(async () => {
          this.assertCurrent(epoch);
          const saved = await this.dependencies.credentials.read();
          this.assertCurrent(epoch);
          if (!saved) throw new AppError('NOT_LOGGED_IN');
          const updated = { ...account, ...profile };
          await this.dependencies.credentials.write({
            ...saved,
            account: updated,
          });
          this.assertCurrent(epoch);
          this.publish({ status: 'signedIn', account: updated, error: null });
        });
      } catch (error) {
        if (epoch !== this.epoch) return;
        if (!isAccessRejected(error)) {
          this.publish({
            status: 'signedIn',
            account,
            error: errorMessage(error),
          });
        } else {
          const nextEpoch = this.epoch + 1;
          await this.signOut();
          if (this.epoch === nextEpoch)
            this.publish({
              status: 'signedOut',
              account: null,
              error: errorMessage(error),
            });
        }
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  };
}
