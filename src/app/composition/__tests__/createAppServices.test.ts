import { createAlunoOnlineAdapter } from '@root/adapters/outbound/aluno-online';
import { createCredentialStore } from '@root/adapters/outbound/persistence/credential-store';
import { createPrivateApiAdapters } from '@root/adapters/outbound/private-api';
import { createScheduleGeneratorAdapter } from '@root/adapters/outbound/schedule-generator';
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
jest.mock('../createWidget', () => ({
  createWidget: jest.fn(() => ({ sync: {} })),
}));
jest.mock('@root/adapters/outbound/native/NativeLaunches', () => ({
  createLaunches: jest.fn(() => null),
}));
jest.mock('../../observability', () => ({
  reportPortalLayoutChanges: (ports: unknown) => ports,
  errorMonitor: {},
  reportPortalLayoutChange: jest.fn(),
  reportQueryError: jest.fn(),
}));

function setup() {
  let saved: SavedAccount | null = null;
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
      getCurriculum: jest.fn(),
      getSchedule: jest.fn(),
      getPartialRid: jest.fn(),
      getEnrollmentResult: jest.fn(),
      getSubjectDetails: jest.fn(),
      getUniversalSubjects: jest.fn(),
    },
    documents: {
      list: jest.fn(async () => []),
      issue: jest.fn(),
      remove: jest.fn(),
    },
    diagnostics: { fetch: jest.fn(), snapshot: jest.fn() },
  } satisfies ReturnType<typeof createAlunoOnlineAdapter>;
  const privateApi = {
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

  it.each([
    [true, '209900000001'],
    [false, '209900000001'],
    [true, 'demo'],
    [false, 'demo'],
  ])(
    'uses portal authentication with __DEV__=%s and matricula=%s',
    async (development, matricula) => {
      globals.__DEV__ = development;
      const { services, portal, scheduleGenerator } = setup();
      const credentials = { matricula, password: 'synthetic-password' };

      await services.identity.signIn(credentials);

      expect(portal.authentication.signIn).toHaveBeenCalledWith(credentials);
      expect(services.academicRecords).toBe(portal.records);
      expect(services.documents).toBe(portal.documents);
      expect(services.scheduleGenerator).toBe(scheduleGenerator);
      expect(services).not.toHaveProperty('demo');
      await services.identity.signOut();
    },
  );

  it('propagates a rejected portal login without accepting an alternative account', async () => {
    globals.__DEV__ = true;
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
