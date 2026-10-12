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
import { loadDemoBackend, withDemoMode } from './demoMode';

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
  // Development builds route demo credentials to fictitious adapters;
  // release builds (and every real credential) use the real ports unchanged.
  const ports = withDemoMode(
    {
      authentication: portal.authentication,
      records: portal.records,
      ...createPrivateApiAdapters(),
      scheduleGenerator: createScheduleGeneratorAdapter(),
      preferences,
    },
    loadDemoBackend(),
  );
  const identity = new IdentityController({
    credentials,
    authentication: ports.authentication,
    accountData: cache.lifecycle,
    createScope,
  });
  const currentAccount = () => identity.getSnapshot().account;
  let startup: Promise<string | null> | null = null;
  return {
    queryClient,
    identity,
    preferences: ports.preferences,
    community: new Community({
      messageBoard: ports.messageBoard,
      teacherDirectory: ports.teacherDirectory,
      currentAccount,
    }),
    support: new SubmitErrorReport(
      ports.errorReporter,
      { appVersion: version, parserVersion: '2' },
      currentAccount,
    ),
    scheduleGenerator: ports.scheduleGenerator,
    academicRecords: ports.records,
    scheduleSharing: new NativeScheduleSharing(),
    flushCache: cache.flush,
    /** null in release builds; see demoMode.ts. */
    demo: ports.demo,
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
