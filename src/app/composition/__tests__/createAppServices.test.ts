import { createAlunoOnlineAdapter } from '@root/adapters/outbound/aluno-online';
import { createCredentialStore } from '@root/adapters/outbound/persistence/credential-store';
import { createPrivateApiAdapters } from '@root/adapters/outbound/private-api';
import { createScheduleGeneratorAdapter } from '@root/adapters/outbound/schedule-generator';
import { DEMO_CREDENTIALS } from '@root/adapters/outbound/demo/account';
import type { SavedAccount } from '@root/modules/identity/domain/types';
import { createAppServices } from '../createAppServices';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@root/adapters/outbound/aluno-online', () => ({
  createAlunoOnlineAdapter: jest.fn(),
}));
jest.mock('@root/adapters/outbound/aluno-online/nativeTransport', () => ({
  createNativeCookieJar: jest.fn(() => ({})),
  createNativePortalTransport: jest.fn(() => ({})),
}));
jest.mock('@root/adapters/outbound/persistence/credential-store', () => ({
  createCredentialStore: jest.fn(),
}));
jest.mock('@root/adapters/outbound/private-api', () => ({
  createPrivateApiAdapters: jest.fn(),
  createPrivateApiClient: jest.fn(() => ({})),
}));
jest.mock('@root/adapters/outbound/schedule-generator', () => ({
  createScheduleGeneratorAdapter: jest.fn(),
}));
jest.mock('@root/adapters/outbound/native/NativeScheduleSharing', () => ({
  NativeScheduleSharing: jest.fn(),
}));
jest.mock('@root/adapters/outbound/native/NativeDocumentSharing', () => ({
  NativeDocumentSharing: jest.fn(),
}));
jest.mock('@root/adapters/outbound/native/NativeAppearance', () => ({
  nativeAppearance: { apply: jest.fn() },
}));
jest.mock('../createDelivery', () => ({
  createDelivery: jest.fn(() => ({ status: {} })),
}));
jest.mock('../createNotifications', () => ({
  createNotifications: jest.fn(() => ({
    settings: {},
    portalCheck: null,
  })),
}));
jest.mock('../createPortalMonitor', () => ({
  createPortalMonitor: jest.fn(() => ({
    guard: jest.fn(),
    answered: jest.fn(),
    failed: jest.fn(),
  })),
}));
jest.mock('../previousInstall', () => ({
  forgetPreviousInstall: jest.fn(async () => undefined),
}));
// sem o cofre (sem o módulo nativo): o cache segue no AsyncStorage
jest.mock('@root/adapters/outbound/native/NativeSecureVault', () => ({
  createSecureVault: jest.fn(() => null),
}));
jest.mock('../createWidget', () => ({
  createWidget: jest.fn(() => ({ sync: {} })),
}));
// a sessão de aluno lê o AppState do React Native, que este teste não carrega
jest.mock('../createStudentSession', () => ({
  createStudentSession: jest.fn(() => ({ supported: false })),
  followIdentity: jest.fn(),
}));
jest.mock('@root/adapters/outbound/native/NativeLaunches', () => ({
  createLaunches: jest.fn(() => null),
}));
jest.mock('../../observability', () => ({
  reportPortalLayoutChanges: (ports: unknown) => ports,
  markDemoAccount: jest.fn(),
  errorMonitor: {},
  reportPortalLayoutChange: jest.fn(),
  reportQueryError: jest.fn(),
}));

function setup(initial: SavedAccount | null = null) {
  let saved = initial;
  const portal = {
    authentication: {
      signIn: jest.fn(async ({ matricula }: { matricula: string }) => ({
        matricula,
        name: 'Estudante',
        period: '2026.2',
      })),
      refresh: jest.fn(),
      signOut: jest.fn(async () => undefined),
    },
    records: {
      getGrades: jest.fn(),
      getHistory: jest.fn(),
      getComplementaryActivities: jest.fn(),
      getCurriculum: jest.fn(),
      getSchedule: jest.fn(),
      getPartialRid: jest.fn(),
      getEnrollmentResult: jest.fn(),
      getSubjectDetails: jest.fn(),
      getUniversalSubjects: jest.fn(),
      getSynthesis: jest.fn(),
    },
    documents: {
      list: jest.fn(async () => []),
      issue: jest.fn(),
      remove: jest.fn(),
    },
    diagnostics: { fetch: jest.fn(), snapshot: jest.fn() },
  } satisfies ReturnType<typeof createAlunoOnlineAdapter>;
  const privateApi = {
    portalStatus: { read: jest.fn(async () => null) },
    messageBoard: { read: jest.fn(async () => []), post: jest.fn() },
    teacherDirectory: { list: jest.fn(async () => []), find: jest.fn() },
    errorReporter: { submit: jest.fn(async () => undefined) },
  };
  const scheduleGenerator = { generate: jest.fn(async () => []) };
  jest.mocked(createCredentialStore).mockReturnValue({
    read: jest.fn(async () => saved),
    write: jest.fn(async value => {
      saved = value;
    }),
    clear: jest.fn(async () => {
      saved = null;
    }),
  });
  jest.mocked(createAlunoOnlineAdapter).mockReturnValue(portal);
  jest.mocked(createPrivateApiAdapters).mockReturnValue(privateApi);
  jest
    .mocked(createScheduleGeneratorAdapter)
    .mockReturnValue(scheduleGenerator);
  return {
    services: createAppServices(),
    portal,
    privateApi,
    scheduleGenerator,
  };
}

describe('real adapter composition', () => {
  const globals = globalThis as { __DEV__?: boolean };
  const original = globals.__DEV__;
  afterEach(() => {
    globals.__DEV__ = original;
  });

  it.each([true, false])(
    'sends a real account to the portal with __DEV__=%s',
    async development => {
      globals.__DEV__ = development;
      const { services, portal, scheduleGenerator } = setup();
      const credentials = {
        matricula: '209900000001',
        password: 'synthetic-password',
      };

      await services.identity.signIn(credentials);
      await services.academicRecords.getGrades();
      await services.documents.list();

      expect(portal.authentication.signIn).toHaveBeenCalledWith(credentials);
      expect(portal.records.getGrades).toHaveBeenCalledTimes(1);
      expect(portal.documents.list).toHaveBeenCalledTimes(1);
      expect(services.scheduleGenerator).toBe(scheduleGenerator);
      expect(services.identity.getSnapshot().account).not.toHaveProperty(
        'demo',
      );
      await services.identity.signOut();
    },
  );

  it('propagates a rejected portal login without accepting an alternative account', async () => {
    const { services, portal } = setup();
    const failure = new Error('Portal authentication rejected');
    portal.authentication.signIn.mockRejectedValue(failure);

    await expect(
      services.identity.signIn({ matricula: 'demo', password: 'demo' }),
    ).rejects.toBe(failure);

    expect(services.identity.getSnapshot()).toMatchObject({
      status: 'signedOut',
      account: null,
    });
  });
});

describe('demo account', () => {
  const touchedServer = (privateApi: ReturnType<typeof setup>['privateApi']) =>
    [
      privateApi.portalStatus.read,
      privateApi.messageBoard.read,
      privateApi.messageBoard.post,
      privateApi.teacherDirectory.list,
      privateApi.teacherDirectory.find,
      privateApi.errorReporter.submit,
    ].some(spy => spy.mock.calls.length > 0);

  it.each([true, false])(
    'answers in the app without the portal or the server, with __DEV__=%s',
    async development => {
      (globalThis as { __DEV__?: boolean }).__DEV__ = development;
      const { services, portal, privateApi } = setup();

      await services.identity.signIn(DEMO_CREDENTIALS);
      expect(services.identity.getSnapshot().account).toMatchObject({
        matricula: DEMO_CREDENTIALS.matricula,
        demo: true,
      });
      expect(await services.academicRecords.getGrades()).not.toHaveLength(0);
      expect(await services.documents.list()).not.toHaveLength(0);
      await services.community.messages({
        subjectId: 'IME01-00001',
        classNumber: '1',
        period: '2026.2',
      });

      expect(portal.authentication.signIn).not.toHaveBeenCalled();
      expect(portal.records.getGrades).not.toHaveBeenCalled();
      expect(portal.documents.list).not.toHaveBeenCalled();
      expect(touchedServer(privateApi)).toBe(false);
      await services.identity.signOut();
    },
  );

  it('refuses a wrong password without asking the portal', async () => {
    const { services, portal } = setup();
    await expect(
      services.identity.signIn({
        matricula: DEMO_CREDENTIALS.matricula,
        password: 'outra',
      }),
    ).rejects.toMatchObject({ code: 'LOGIN_FAILED' });
    expect(portal.authentication.signIn).not.toHaveBeenCalled();
  });

  it('keeps a saved demo account on the demo, even before the sign-in of the round', async () => {
    const { services, portal } = setup({
      credentials: DEMO_CREDENTIALS,
      account: {
        matricula: DEMO_CREDENTIALS.matricula,
        name: 'Conta salva',
        period: '2026.2',
        scope: 'account-demo',
        demo: true,
      },
    });
    // uma rodada em segundo plano lê sem fazer login
    expect(await services.academicRecords.getSchedule()).not.toHaveLength(0);
    await services.initialize();
    expect(services.identity.getSnapshot().status).toBe('signedIn');
    expect(portal.authentication.signIn).not.toHaveBeenCalled();
    expect(portal.records.getSchedule).not.toHaveBeenCalled();
  });

  it('goes back to the portal after leaving the demo', async () => {
    const { services, portal } = setup();
    await services.identity.signIn(DEMO_CREDENTIALS);
    await services.identity.signOut();
    const credentials = {
      matricula: '209900000001',
      password: 'synthetic-password',
    };
    await services.identity.signIn(credentials);
    await services.academicRecords.getGrades();
    expect(portal.authentication.signIn).toHaveBeenCalledWith(credentials);
    expect(portal.records.getGrades).toHaveBeenCalledTimes(1);
    expect(services.identity.getSnapshot().account).not.toHaveProperty('demo');
  });
});

it('forgets the absences marked on the device at logout', async () => {
  const { services } = setup();
  await services.identity.signIn({
    matricula: '202300000001',
    password: 'synthetic-password',
  });
  const scope = services.identity.getSnapshot().account!.scope;
  const meeting = {
    subjectId: '778',
    date: '2026-10-15',
    start: 860,
    end: 960,
    slots: 2,
  };
  await services.attendance.mark(scope, '2026.1', meeting, true);
  expect(await services.attendance.read(scope, '2026.1')).toHaveLength(1);

  await services.identity.signOut();

  expect(await services.attendance.read(scope, '2026.1')).toEqual([]);
});
