import * as Keychain from 'react-native-keychain';
import type { CredentialStore } from '@root/modules/identity/application/ports';
import type { SavedAccount } from '@root/modules/identity/domain/types';
import { AppError } from '@root/shared/errors/AppError';

const service = 'br.uerj.ao.credentials.v2';

function isSavedAccount(value: unknown): value is SavedAccount {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<SavedAccount>;
  return (
    [
      record.credentials?.matricula,
      record.credentials?.password,
      record.account?.matricula,
      record.account?.name,
      record.account?.period,
      record.account?.scope,
    ].every(item => typeof item === 'string' && item.length > 0) &&
    record.credentials?.matricula === record.account?.matricula
  );
}

export function createCredentialStore(): CredentialStore {
  return {
    async read() {
      try {
        const entry = await Keychain.getGenericPassword({ service });
        if (!entry) return null;
        const saved: unknown = JSON.parse(entry.password);
        if (!isSavedAccount(saved)) throw new AppError('STORAGE_FAILED');
        return saved;
      } catch {
        throw new AppError('STORAGE_FAILED');
      }
    },
    async write(saved) {
      try {
        if (!isSavedAccount(saved)) throw new AppError('STORAGE_FAILED');
        await Keychain.setGenericPassword(
          saved.account.scope,
          JSON.stringify(saved),
          {
            service,
            accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          },
        );
        const verified = await Keychain.getGenericPassword({ service });
        if (!verified || verified.password !== JSON.stringify(saved))
          throw new AppError('STORAGE_FAILED');
      } catch {
        throw new AppError('STORAGE_FAILED');
      }
    },
    async clear() {
      try {
        await Keychain.resetGenericPassword({ service });
      } catch {
        throw new AppError('STORAGE_FAILED');
      }
    },
  };
}
