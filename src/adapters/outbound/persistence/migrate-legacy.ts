import type { CredentialStore } from '@root/modules/identity/application/ports';
import type { PreferencesStore } from '@root/modules/identity/application/PreferencesStore';
import type { SavedAccount } from '@root/modules/identity/domain/types';
import { AppError } from '@root/shared/errors/AppError';
import type { KeyValueStorage } from './storage';

type LegacyUser = {
  matricula?: unknown;
  password?: unknown;
  name?: unknown;
  periodo?: unknown;
};

function legacyAccount(
  value: unknown,
  createScope: () => string,
): SavedAccount | null {
  if (!value || typeof value !== 'object') return null;
  const user = value as LegacyUser;
  if (
    ![user.matricula, user.password, user.name, user.periodo].every(
      item => typeof item === 'string' && item.length > 0,
    )
  )
    return null;
  return {
    credentials: {
      matricula: user.matricula as string,
      password: user.password as string,
    },
    account: {
      scope: createScope(),
      matricula: user.matricula as string,
      name: user.name as string,
      period: user.periodo as string,
    },
  };
}

/** Runs before any persistence reader; replay after an interruption is safe. */
export async function migrateLegacyStorage(
  storage: KeyValueStorage,
  vault: CredentialStore,
  preferences: PreferencesStore,
  createScope: () => string,
): Promise<void> {
  const raw = await storage.getItem('persist:root');
  let transferring = false;
  try {
    if (!raw) return;
    const root = JSON.parse(raw) as { userInfo?: string };
    const legacy = root.userInfo
      ? legacyAccount(JSON.parse(root.userInfo), createScope)
      : null;
    const existing = await vault.read();
    const saved = existing ?? legacy;
    if (!existing && legacy) {
      transferring = true;
      await vault.write(legacy);
      transferring = false;
    }
    const credits = await storage.getItem('@elective_credits_config');
    if (
      credits &&
      saved &&
      saved.account.matricula === legacy?.account.matricula
    ) {
      const parsed = JSON.parse(credits) as Record<string, unknown>;
      if (
        ['RESTRICTED', 'DEFINED', 'UNIVERSAL'].every(
          key =>
            typeof parsed[key] === 'number' &&
            Number.isFinite(parsed[key]) &&
            (parsed[key] as number) >= 0,
        )
      ) {
        await preferences.write(
          saved.account.scope,
          'elective-credits',
          parsed,
        );
      }
    }
  } catch {
    // A native write can persist data and then fail its verification read.
    // Such a record must not become an automatically restored login.
    if (transferring) await vault.clear().catch(() => undefined);
    throw new AppError('STORAGE_FAILED');
  } finally {
    // Remove unencrypted credentials even if secure transfer failed. A new
    // login is preferable to silently retaining the legacy secret.
    const removed = await Promise.allSettled([
      storage.removeItem('persist:root'),
      storage.removeItem('@elective_credits_config'),
    ]);
    if (removed.some(result => result.status === 'rejected'))
      throw new AppError('STORAGE_FAILED');
  }
}
