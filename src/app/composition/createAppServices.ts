import AsyncStorage from '@react-native-async-storage/async-storage';
import { bundledCampusMap } from '@root/adapters/outbound/campus-map';
import { CampusMap } from '@root/modules/campus-map/application/CampusMap';
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
import { NativeDocumentSharing } from '@root/adapters/outbound/native/NativeDocumentSharing';
import { createLaunches } from '@root/adapters/outbound/native/NativeLaunches';
import { nativeAppearance } from '@root/adapters/outbound/native/NativeAppearance';
import { createAppKeyValueStore } from '@root/adapters/outbound/delivery/appStore';
import { createPrivateApiAdapters } from '@root/adapters/outbound/private-api';
import { createScheduleGeneratorAdapter } from '@root/adapters/outbound/schedule-generator';
import { IdentityController } from '@root/modules/identity/application/IdentityController';
import { Community } from '@root/modules/community/application/Community';
import { SubmitErrorReport } from '@root/modules/support/application/SubmitErrorReport';
import { ThemePreferences } from '@root/modules/appearance/application/ThemePreferences';
import { version } from '../../../package.json';
import { createQueryClient } from '../queryClient';
import {
  errorMonitor,
  reportPortalLayoutChange,
  reportPortalLayoutChanges,
  reportQueryError,
} from '../observability';
import {
  CHECK_STATE_KEY,
  PREFERENCES_KEY,
} from '@root/modules/notifications/application/NotificationSettings';
import {
  ATTENDANCE_KEY,
  AttendanceRecords,
} from '@root/modules/attendance/application/AttendanceRecords';
import {
  PREREQUISITES_KEY,
  PrerequisiteCatalog,
} from '@root/modules/graduation/application/PrerequisiteCatalog';
import {
  PLAN_PREFERENCES_KEY,
  PlanPreferencesStore,
} from '@root/modules/graduation/application/PlanPreferencesStore';
import { APP_INFO_VERSION_KEY } from '@features/AppInfoModal/info';
import { initializeIdentity } from './initializeIdentity';
import { createDelivery } from './createDelivery';
import { createNotifications } from './createNotifications';
import { createWidget } from './createWidget';

/** Preferências da conta que o logout apaga junto com o cache. */
const ACCOUNT_PREFERENCES = [
  'elective-credits',
  PREFERENCES_KEY,
  CHECK_STATE_KEY,
  ATTENDANCE_KEY,
  PREREQUISITES_KEY,
  PLAN_PREFERENCES_KEY,
  APP_INFO_VERSION_KEY,
] as const;

function createScope() {
  return `account-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export function createAppServices() {
  const queryClient = createQueryClient(reportQueryError);
  const credentials = createCredentialStore();
  const preferences = createPreferencesStore(AsyncStorage);
  const cache = createQueryAccountCache(
    queryClient,
    AsyncStorage,
    async scope => {
      await Promise.all(
        ACCOUNT_PREFERENCES.map(key => preferences.remove(scope, key)),
      );
    },
  );
  const portal = reportPortalLayoutChanges(
    createAlunoOnlineAdapter({
      transport: createNativePortalTransport(),
      cookies: createNativeCookieJar(),
      readCredentials: async () =>
        (await credentials.read())?.credentials ?? null,
    }),
    reportPortalLayoutChange,
  );
  const privateApi = createPrivateApiAdapters();
  const identity = new IdentityController({
    credentials,
    authentication: portal.authentication,
    accountData: cache.lifecycle,
    createScope,
  });
  const currentAccount = () => identity.getSnapshot().account;
  let startup: Promise<string | null> | null = null;
  const delivery = createDelivery({
    appVersion: version,
    preferences,
    identity,
  });
  const notifications = createNotifications({
    queryClient,
    identity,
    preferences,
    records: portal.records,
    documents: portal.documents,
    remoteStatus: delivery.status,
    flushCache: cache.flush,
    savedScope: async () => (await credentials.read())?.account.scope ?? null,
  });
  return {
    campusMap: new CampusMap(bundledCampusMap),
    queryClient,
    identity,
    preferences,
    community: new Community({
      messageBoard: privateApi.messageBoard,
      teacherDirectory: privateApi.teacherDirectory,
      currentAccount,
    }),
    support: new SubmitErrorReport(
      privateApi.errorReporter,
      { appVersion: version, parserVersion: '2' },
      currentAccount,
      errorMonitor,
    ),
    scheduleGenerator: createScheduleGeneratorAdapter(),
    academicRecords: portal.records,
    scheduleSharing: new NativeScheduleSharing(),
    documents: portal.documents,
    documentSharing: new NativeDocumentSharing(),
    delivery,
    notifications,
    // faltas marcadas pelo aluno, só no aparelho (o logout apaga)
    attendance: new AttendanceRecords(preferences),
    // plano até a formatura: pré-requisitos lidos e as escolhas do aluno
    graduation: {
      prerequisites: new PrerequisiteCatalog(preferences),
      preferences: new PlanPreferencesStore(preferences),
    },
    // aviso tocado, atalho do ícone ou widget: a tela que o app abre
    launches: createLaunches(),
    widget: createWidget({ queryClient, identity }),
    // App-wide: the theme survives logout.
    appearance: new ThemePreferences({
      store: createAppKeyValueStore(preferences),
      native: nativeAppearance,
    }),
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
