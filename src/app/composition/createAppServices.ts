import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAlunoOnlineAdapter } from '@root/adapters/outbound/aluno-online';
import {
  createNativeCookieJar,
  createNativePortalTransport,
} from '@root/adapters/outbound/aluno-online/nativeTransport';
import { createCredentialStore } from '@root/adapters/outbound/persistence/credential-store';
import { createPreferencesStore } from '@root/adapters/outbound/persistence/preferences';
import { createQueryAccountCache } from '@root/adapters/outbound/persistence/query-account-cache';
import { migrateLegacyStorage } from '@root/adapters/outbound/persistence/migrate-legacy';
import { NativeScheduleSharing } from '@root/adapters/outbound/native/NativeScheduleSharing';
import { createPrivateApiAdapters } from '@root/adapters/outbound/private-api';
import { createScheduleGeneratorAdapter } from '@root/adapters/outbound/schedule-generator';
import { IdentityController } from '@root/modules/identity/application/IdentityController';
import { Community } from '@root/modules/community/application/Community';
import { SubmitErrorReport } from '@root/modules/support/application/SubmitErrorReport';
import { version } from '../../../package.json';
import { createQueryClient } from '../queryClient';
import { initializeIdentity } from './initializeIdentity';

function createScope() {
  return `account-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export function createAppServices() {
  const queryClient = createQueryClient();
  const credentials = createCredentialStore();
  const preferences = createPreferencesStore(AsyncStorage);
  const cache = createQueryAccountCache(queryClient, AsyncStorage, scope =>
    preferences.remove(scope, 'elective-credits'),
  );
  const portal = createAlunoOnlineAdapter({
    transport: createNativePortalTransport(),
    cookies: createNativeCookieJar(),
    readCredentials: async () =>
      (await credentials.read())?.credentials ?? null,
  });
  const identity = new IdentityController({
    credentials,
    authentication: portal.authentication,
    accountData: cache.lifecycle,
    createScope,
  });
  const privateApi = createPrivateApiAdapters();
  const currentAccount = () => identity.getSnapshot().account;
  let startup: Promise<string | null> | null = null;
  return {
    queryClient,
    identity,
    preferences,
    community: new Community({ ...privateApi, currentAccount }),
    support: new SubmitErrorReport(
      privateApi.errorReporter,
      { appVersion: version, parserVersion: '2' },
      currentAccount,
    ),
    scheduleGenerator: createScheduleGeneratorAdapter(),
    academicRecords: portal.records,
    scheduleSharing: new NativeScheduleSharing(),
    flushCache: cache.flush,
    initialize() {
      startup ??= initializeIdentity(
        () =>
          migrateLegacyStorage(
            AsyncStorage,
            credentials,
            preferences,
            createScope,
          ),
        identity,
      );
      return startup;
    },
  };
}

export type AppServices = ReturnType<typeof createAppServices>;
