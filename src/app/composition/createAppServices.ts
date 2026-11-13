import AsyncStorage from '@react-native-async-storage/async-storage';
import { observePortalTransport } from '@root/adapters/outbound/aluno-online/observedTransport';
import { isPortalAnswer } from '@root/modules/connectivity/application/PortalMonitor';
import { PORTAL_RETURN_KEY } from '@root/modules/notifications/application/PortalReturnAlert';
import { bundledCampusMap } from '@root/adapters/outbound/campus-map';
import { CampusMap } from '@root/modules/campus-map/application/CampusMap';
import { createAlunoOnlineAdapter } from '@root/adapters/outbound/aluno-online';
import {
  createNativeCookieJar,
  createNativePortalTransport,
} from '@root/adapters/outbound/aluno-online/nativeTransport';
import { createCredentialStore } from '@root/adapters/outbound/persistence/credential-store';
import { createPreferencesStore } from '@root/adapters/outbound/persistence/preferences';
import {
  createQueryAccountCache,
  longLivedCacheAge,
} from '@root/adapters/outbound/persistence/query-account-cache';
import { createSecureVault } from '@root/adapters/outbound/native/NativeSecureVault';
import { createVaultStorage } from '@root/adapters/outbound/persistence/vault-storage';
import { createSavedDocumentsStore } from '@root/adapters/outbound/persistence/saved-documents';
import { migrateLegacyStorage } from '@root/adapters/outbound/persistence/migrate-legacy';
import { NativeScheduleSharing } from '@root/adapters/outbound/native/NativeScheduleSharing';
import { NativeDocumentSharing } from '@root/adapters/outbound/native/NativeDocumentSharing';
import { createLaunches } from '@root/adapters/outbound/native/NativeLaunches';
import { nativeAppearance } from '@root/adapters/outbound/native/NativeAppearance';
import { createAppKeyValueStore } from '@root/adapters/outbound/delivery/appStore';
import {
  createPrivateApiAdapters,
  createPrivateApiClient,
} from '@root/adapters/outbound/private-api';
import { createScheduleGeneratorAdapter } from '@root/adapters/outbound/schedule-generator';
import { createSessionClient } from '@root/adapters/outbound/private-api/sessionClient';
import { IdentityController } from '@root/modules/identity/application/IdentityController';
import { Community } from '@root/modules/community/application/Community';
import { SubmitErrorReport } from '@root/modules/support/application/SubmitErrorReport';
import { GeneratorRunLog } from '@root/modules/planning/application/GeneratorRunLog';
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
import { GOOD_NEWS_SEEN_KEY } from '@root/modules/notifications/application/GoodNews';
import {
  ATTENDANCE_KEY,
  AttendanceRecords,
} from '@root/modules/attendance/application/AttendanceRecords';
import {
  EVALUATIONS_KEY,
  EvaluationRecords,
} from '@root/modules/evaluations/application/EvaluationRecords';
import {
  PREREQUISITES_KEY,
  PrerequisiteCatalog,
} from '@root/modules/graduation/application/PrerequisiteCatalog';
import {
  PLAN_PREFERENCES_KEY,
  PlanPreferencesStore,
} from '@root/modules/graduation/application/PlanPreferencesStore';
import { APP_INFO_VERSION_KEY } from '@features/AppInfoModal/info';
import {
  COMPANION_INVITE_KEY,
  COMPANION_NAME_KEY,
} from '@root/modules/companion/application/CompanionCalls';
import { COMPANION_WATCH_KEY } from '@root/modules/companion/application/CompanionWatch';
import { HOME_LAYOUT_KEY } from '@root/modules/home/domain/homeLayout';
import { CAMPUS_STATE_KEY } from '@root/modules/campus-now/application/campusState';
import { initializeIdentity } from './initializeIdentity';
import { createDelivery } from './createDelivery';
import { createNotifications } from './createNotifications';
import { createPortalMonitor } from './createPortalMonitor';
import { forgetPreviousInstall } from './previousInstall';
import { createCompanion } from './createCompanion';
import { createCampusNow } from './createCampusNow';
import { createStudentSession, followIdentity } from './createStudentSession';
import { createWidget } from './createWidget';

/** Preferências da conta que o logout apaga junto com o cache. */
const ACCOUNT_PREFERENCES = [
  'elective-credits',
  PREFERENCES_KEY,
  CHECK_STATE_KEY,
  GOOD_NEWS_SEEN_KEY,
  ATTENDANCE_KEY,
  EVALUATIONS_KEY,
  PREREQUISITES_KEY,
  PLAN_PREFERENCES_KEY,
  APP_INFO_VERSION_KEY,
  PORTAL_RETURN_KEY,
  COMPANION_NAME_KEY,
  COMPANION_WATCH_KEY,
  COMPANION_INVITE_KEY,
  HOME_LAYOUT_KEY,
  CAMPUS_STATE_KEY,
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
  // cache cifrado no cofre (Android e iOS), com o essencial valendo o
  // período; sem o cofre, o cache segue no AsyncStorage por 7 dias
  const vault = createSecureVault();
  const savedDocuments = vault ? createSavedDocumentsStore(vault) : null;
  const cache = createQueryAccountCache(
    queryClient,
    vault ? createVaultStorage(vault, AsyncStorage) : AsyncStorage,
    async scope => {
      await Promise.all([
        ...ACCOUNT_PREFERENCES.map(key => preferences.remove(scope, key)),
        savedDocuments?.clear(scope),
      ]);
    },
    vault ? { maxAge: longLivedCacheAge } : {},
  );
  const privateClient = createPrivateApiClient();
  // a sessão de aluno no servidor, no cofre: a matrícula e o nome da conta
  // logada, atestados pela Play (no iPhone, pelo App Attest); o logout a
  // encerra
  const studentSession = createStudentSession({
    vault,
    client: privateClient,
    account: () => identity.getSnapshot().account,
  });
  const studentClient = createSessionClient(privateClient, studentSession);
  const privateApi = createPrivateApiAdapters(privateClient, studentClient);
  const transport = createNativePortalTransport();
  // a página inicial do portal: leve e o primeiro passo do próprio login
  const probePortal = async () =>
    (await transport.request({ path: '/' })).status;
  const portalMonitor = createPortalMonitor({
    probe: probePortal,
    shared: privateApi.portalStatus,
  });
  const portal = reportPortalLayoutChanges(
    createAlunoOnlineAdapter({
      transport: observePortalTransport(transport, portalMonitor),
      cookies: createNativeCookieJar(),
      readCredentials: async () =>
        (await credentials.read())?.credentials ?? null,
    }),
    reportPortalLayoutChange,
  );
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
  const evaluations = new EvaluationRecords(preferences);
  // encontros de minutos entre alunos, com as chaves de membro no cofre
  const companion = createCompanion({
    student: studentClient,
    session: studentSession,
    vault,
  });
  // avisos dos alunos sobre o campus, com a sessão de aluno
  const campusNow = createCampusNow({
    student: studentClient,
    session: studentSession,
    preferences,
    account: currentAccount,
  });
  // no logout, sai das mesas e dos grupos e só então encerra a sessão
  followIdentity(studentSession, identity, {
    beforeClear: () => companion.clear(),
  });
  const notifications = createNotifications({
    queryClient,
    identity,
    preferences,
    records: portal.records,
    evaluations,
    documents: portal.documents,
    remoteStatus: delivery.status,
    flushCache: cache.flush,
    savedScope: async () => (await credentials.read())?.account.scope ?? null,
    probePortal: async () => isPortalAnswer(await probePortal()),
    companion,
    campusNow,
  });
  return {
    campusMap: new CampusMap(bundledCampusMap),
    queryClient,
    identity,
    // disponibilidade do Aluno Online: queda, lentidão e nova tentativa
    portalMonitor,
    preferences,
    community: new Community({
      messageBoard: privateApi.messageBoard,
      teacherDirectory: privateApi.teacherDirectory,
      currentAccount,
    }),
    support: new SubmitErrorReport(
      privateApi.errorReporter,
      {
        appVersion: version,
        parserVersion: '3',
        // com OTA, a mesma versão roda códigos diferentes: o id diz qual
        updateId: delivery.runningUpdate?.id,
      },
      currentAccount,
      errorMonitor,
    ),
    scheduleGenerator: createScheduleGeneratorAdapter(
      undefined,
      studentSession,
    ),
    // a última tentativa no gerador, em contagens, para o relato da tela
    generatorRuns: new GeneratorRunLog(),
    academicRecords: portal.records,
    scheduleSharing: new NativeScheduleSharing(),
    documents: portal.documents,
    documentSharing: new NativeDocumentSharing(),
    // PDFs que o aluno guardou para usar sem o portal (no cofre)
    savedDocuments,
    delivery,
    notifications,
    studentSession,
    companion,
    campusNow,
    // faltas marcadas pelo aluno, só no aparelho (o logout apaga)
    attendance: new AttendanceRecords(preferences),
    // datas de provas e trabalhos anotadas, também só no aparelho
    evaluations,
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
      startup ??= initializeIdentity(async () => {
        // iOS: a conta salva no Keychain antes de uma desinstalação não volta
        await forgetPreviousInstall(AsyncStorage, credentials);
        await migrateLegacyStorage(
          AsyncStorage,
          credentials,
          preferences,
          createScope,
        );
      }, identity);
      return startup;
    },
  };
}

export type AppServices = ReturnType<typeof createAppServices>;
