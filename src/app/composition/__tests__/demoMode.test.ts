import {
  createDemoBackend,
  demoCredentials,
  DEMO_STUDENT,
} from '@root/adapters/outbound/demo';
import { IdentityController } from '@root/modules/identity/application/IdentityController';
import type { CredentialStore } from '@root/modules/identity/application/ports';
import type {
  SavedAccount,
  StudentProfile,
} from '@root/modules/identity/domain/types';
import {
  loadDemoBackend,
  withDemoMode,
  type SwitchablePorts,
} from '../demoMode';

const DEMO_PROFILE = { ...DEMO_STUDENT, matricula: 'demo' };
const realProfile: StudentProfile = {
  matricula: '201900000001',
  name: 'ESTUDANTE REAL FICTÍCIO',
  period: '2026.2',
};
const realCredentials = { matricula: '201900000001', password: 'senha-real' };
const thread = { subjectId: 'IME02-10892', classNumber: '2', period: '2026.2' };

function createRealPorts() {
  const stored = new Map<string, unknown>();
  const real = {
    authentication: {
      signIn: jest.fn(async () => realProfile),
      refresh: jest.fn(async () => realProfile),
      signOut: jest.fn(async () => undefined),
    },
    records: {
      getGrades: jest.fn(async () => []),
      getHistory: jest.fn(async () => []),
      getCurriculum: jest.fn(async () => []),
      getSchedule: jest.fn(async () => []),
      getPartialRid: jest.fn(async () => ({ subjects: [], updatedAt: '' })),
      getSubjectDetails: jest.fn(async () => ({ id: 'REAL01-00001' })),
      getUniversalSubjects: jest.fn(async () => []),
    },
    messageBoard: {
      read: jest.fn(async () => []),
      post: jest.fn(),
    },
    teacherDirectory: { list: jest.fn(async () => []), find: jest.fn() },
    errorReporter: { submit: jest.fn(async () => undefined) },
    scheduleGenerator: { generate: jest.fn(async () => []) },
    preferences: {
      read: jest.fn(async (scope: string, key: string) =>
        stored.has(`${scope}:${key}`) ? stored.get(`${scope}:${key}`) : null,
      ),
      write: jest.fn(async (scope: string, key: string, value: unknown) => {
        stored.set(`${scope}:${key}`, value);
      }),
      remove: jest.fn(async (scope: string, key: string) => {
        stored.delete(`${scope}:${key}`);
      }),
    },
  };
  return real as typeof real & SwitchablePorts;
}

const demoBackend = () => createDemoBackend({ latencyMs: 0 });

describe('loadDemoBackend', () => {
  const global = globalThis as { __DEV__?: boolean };
  const original = global.__DEV__;
  afterEach(() => {
    global.__DEV__ = original;
  });

  it('never loads the demo outside development builds', () => {
    global.__DEV__ = false;
    expect(loadDemoBackend()).toBeNull();
  });

  it('loads the demo backend in development builds', () => {
    global.__DEV__ = true;
    expect(loadDemoBackend()?.scenarioOf(demoCredentials())).toBe('padrao');
  });
});

describe('withDemoMode without a backend (release builds)', () => {
  it('returns the real ports themselves', () => {
    const real = createRealPorts();
    const ports = withDemoMode(real, null);
    expect(ports.demo).toBeNull();
    (Object.keys(real) as (keyof SwitchablePorts)[]).forEach(key =>
      expect(ports[key]).toBe(real[key]),
    );
  });

  it('sends even demo credentials to the real portal', async () => {
    const real = createRealPorts();
    await withDemoMode(real, null).authentication.signIn(demoCredentials());
    expect(real.authentication.signIn).toHaveBeenCalledWith(demoCredentials());
  });
});

describe('withDemoMode in development builds', () => {
  it('keeps real accounts on the real adapters', async () => {
    const real = createRealPorts();
    const ports = withDemoMode(real, demoBackend());

    await expect(ports.authentication.signIn(realCredentials)).resolves.toBe(
      realProfile,
    );
    expect(real.authentication.signIn).toHaveBeenCalledWith(realCredentials);
    expect(ports.demo?.activeScenario()).toBeNull();

    await ports.records.getGrades();
    await ports.records.getSubjectDetails('10892');
    await ports.messageBoard.read(thread);
    await ports.authentication.refresh();
    expect(real.records.getGrades).toHaveBeenCalledTimes(1);
    expect(real.records.getSubjectDetails).toHaveBeenCalledWith(
      '10892',
      undefined,
    );
    expect(real.messageBoard.read).toHaveBeenCalledTimes(1);
    expect(real.authentication.refresh).toHaveBeenCalledTimes(1);
    expect(
      await ports.preferences.read('scope-real', 'elective-credits'),
    ).toBeNull();
  });

  it.each([
    { matricula: 'demo', password: 'senha-real' },
    { matricula: '202310045612', password: 'demo' },
  ])('sends near-demo credentials %j to the real portal', async credentials => {
    const real = createRealPorts();
    await withDemoMode(real, demoBackend()).authentication.signIn(credentials);
    expect(real.authentication.signIn).toHaveBeenCalledWith(credentials);
  });

  it('serves demo credentials from fictitious adapters only', async () => {
    const real = createRealPorts();
    const ports = withDemoMode(real, demoBackend());

    await expect(
      ports.authentication.signIn(demoCredentials()),
    ).resolves.toEqual(DEMO_PROFILE);
    expect(real.authentication.signIn).not.toHaveBeenCalled();
    // A previous real portal session is dropped first.
    expect(real.authentication.signOut).toHaveBeenCalled();
    expect(ports.demo?.activeScenario()).toBe('padrao');

    expect(await ports.records.getGrades()).toHaveLength(5);
    expect(await ports.messageBoard.read(thread)).toHaveLength(5);
    await ports.errorReporter.submit({
      page: 'Sobre',
      description: 'teste',
      diagnostic: {
        schemaVersion: 1,
        operation: 'Sobre',
        category: 'USER_REPORT',
        appVersion: '1.3.5',
        parserVersion: '2',
      },
    });
    await expect(ports.authentication.refresh()).resolves.toEqual(DEMO_PROFILE);
    Object.values(real.records).forEach(read =>
      expect(read).not.toHaveBeenCalled(),
    );
    expect(real.messageBoard.read).not.toHaveBeenCalled();
    expect(real.errorReporter.submit).not.toHaveBeenCalled();
    expect(real.authentication.refresh).not.toHaveBeenCalled();
  });

  it('returns to the real adapters after signing out of the demo', async () => {
    const real = createRealPorts();
    const ports = withDemoMode(real, demoBackend());
    await ports.authentication.signIn(demoCredentials('rid'));
    await ports.authentication.signOut();
    expect(ports.demo?.activeScenario()).toBeNull();
    await ports.records.getSchedule();
    expect(real.records.getSchedule).toHaveBeenCalledTimes(1);

    await ports.authentication.signIn(demoCredentials());
    await ports.authentication.signIn(realCredentials);
    await ports.records.getGrades();
    expect(real.records.getGrades).toHaveBeenCalledTimes(1);
  });

  it('suggests configured elective credits only for the demo account', async () => {
    const real = createRealPorts();
    const ports = withDemoMode(real, demoBackend());
    await ports.authentication.signIn(demoCredentials());
    expect(
      await ports.preferences.read('scope-demo', 'elective-credits'),
    ).toEqual({ RESTRICTED: 16, DEFINED: 8, UNIVERSAL: 4 });
    expect(await ports.preferences.read('scope-demo', 'other')).toBeNull();
    // Whatever the student saves (e.g. "Resetar") wins over the suggestion.
    const reset = { RESTRICTED: 0, DEFINED: 0, UNIVERSAL: 0 };
    await ports.preferences.write('scope-demo', 'elective-credits', reset);
    expect(
      await ports.preferences.read('scope-demo', 'elective-credits'),
    ).toEqual(reset);
  });
});

describe('demo mode through the identity controller', () => {
  function vault() {
    let value: SavedAccount | null = null;
    const store: CredentialStore = {
      read: async () => value,
      write: async next => {
        value = next;
      },
      clear: async () => {
        value = null;
      },
    };
    return store;
  }
  const accountData = {
    activate: async () => undefined,
    clear: async () => undefined,
  };

  it('restores the demo session after an app restart', async () => {
    const credentials = vault();
    const backend = demoBackend();
    const first = withDemoMode(createRealPorts(), backend);
    await new IdentityController({
      credentials,
      accountData,
      authentication: first.authentication,
      createScope: () => 'scope-demo',
    }).signIn(demoCredentials());

    const real = createRealPorts();
    const restarted = withDemoMode(real, backend);
    const identity = new IdentityController({
      credentials,
      accountData,
      authentication: restarted.authentication,
      createScope: () => 'scope-other',
    });
    await identity.restore();
    expect(identity.getSnapshot()).toMatchObject({
      status: 'signedIn',
      account: { ...DEMO_PROFILE, scope: 'scope-demo' },
    });
    expect(await restarted.records.getSchedule()).not.toHaveLength(0);
    expect(real.authentication.signIn).not.toHaveBeenCalled();
  });
});
