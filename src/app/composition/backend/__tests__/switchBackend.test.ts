import { DEMO_CREDENTIALS } from '@root/adapters/outbound/demo/account';
import type { Credentials } from '@root/modules/identity/domain/types';
import type { Backend } from '../Backend';
import { switchBackend } from '../switchBackend';

const REAL: Credentials = { matricula: '209900000001', password: 'senha' };

/** Um backend de espiões: cada método responde com o nome do backend. */
function fakeBackend(name: string) {
  const answer = jest.fn(async () => name);
  const port = (...methods: string[]) =>
    Object.fromEntries(methods.map(method => [method, answer]));
  class Records {
    // métodos de classe também são repassados (ficam no protótipo)
    getGrades() {
      return answer();
    }
  }
  const backend = {
    authentication: {
      signIn: jest.fn(async ({ matricula }: Credentials) => ({
        matricula,
        name,
        period: '2026.2',
      })),
      refresh: jest.fn(async () => ({
        matricula: name,
        name,
        period: '2026.2',
      })),
      signOut: jest.fn(async () => undefined),
    },
    records: Object.assign(new Records(), port('getHistory', 'getSchedule')),
    documents: port('list', 'issue', 'remove'),
    portalProbe: port('status'),
    portalStatus: port('read'),
    messageBoard: port('read', 'post'),
    teacherDirectory: port('list', 'find'),
    errorReporter: port('submit'),
    companion: port('pass', 'list', 'open', 'join', 'read', 'leave'),
    companionWatch: port('status', 'put', 'remove'),
    campus: port('list', 'report', 'you', 'community'),
    campusPush: port('status', 'register', 'unregister'),
    studentSessionApi: port('challenge', 'create', 'end'),
  } as unknown as Backend;
  return { backend, answer };
}

function setup(saved: Credentials | null = null) {
  const real = fakeBackend('real');
  const demo = fakeBackend('demo');
  const loadDemo = jest.fn(() => demo.backend);
  const backend = switchBackend(real.backend, {
    savedCredentials: async () => saved,
    loadDemo,
  });
  return { backend, real, demo, loadDemo };
}

it('forwards every method of every port, including class methods', async () => {
  const { backend, real, loadDemo } = setup();
  for (const key of Object.keys(real.backend) as (keyof Backend)[]) {
    if (key === 'authentication') continue;
    const port = backend[key] as unknown as Record<string, () => unknown>;
    expect(Object.keys(port).length).toBeGreaterThan(0);
    for (const method of Object.keys(port))
      await expect(port[method]()).resolves.toBe('real');
  }
  expect(await backend.records.getGrades()).toBe('real');
  expect(loadDemo).not.toHaveBeenCalled();
});

it('answers a saved demo account from the demo before any sign-in', async () => {
  const { backend, real, demo } = setup(DEMO_CREDENTIALS);
  await expect(backend.records.getSchedule()).resolves.toBe('demo');
  await expect(backend.studentSessionApi.challenge()).resolves.toBe('demo');
  expect(real.answer).not.toHaveBeenCalled();
  expect(demo.answer).toHaveBeenCalledTimes(2);
});

it('switches at sign-in and goes back to the real backend at sign-out', async () => {
  const { backend, real, demo, loadDemo } = setup();

  await backend.authentication.signIn(DEMO_CREDENTIALS);
  expect(demo.backend.authentication.signIn).toHaveBeenCalledWith(
    DEMO_CREDENTIALS,
  );
  // a sessão do portal não fica aberta ao entrar na demo
  expect(real.backend.authentication.signOut).toHaveBeenCalledTimes(1);
  await expect(backend.documents.list()).resolves.toBe('demo');

  await backend.authentication.signOut();
  expect(demo.backend.authentication.signOut).toHaveBeenCalledTimes(1);
  await expect(backend.documents.list()).resolves.toBe('real');

  await backend.authentication.signIn(REAL);
  expect(real.backend.authentication.signIn).toHaveBeenCalledWith(REAL);
  await expect(backend.records.getGrades()).resolves.toBe('real');

  // uma só demo para o app aberto (o que ela guarda na memória fica)
  await backend.authentication.signIn(DEMO_CREDENTIALS);
  expect(loadDemo).toHaveBeenCalledTimes(1);
});

it('keeps the demo matricula away from the portal even with a wrong password', async () => {
  const { backend, real, demo } = setup();
  const wrong = { matricula: ` ${DEMO_CREDENTIALS.matricula} `, password: 'x' };
  await backend.authentication.signIn(wrong);
  expect(real.backend.authentication.signIn).not.toHaveBeenCalled();
  expect(demo.backend.authentication.signIn).toHaveBeenCalledWith(wrong);
});

it('refreshes the account of the backend in use', async () => {
  const { backend, demo } = setup(DEMO_CREDENTIALS);
  await backend.authentication.refresh();
  expect(demo.backend.authentication.refresh).toHaveBeenCalledTimes(1);
});

it('uses the real backend when the saved account cannot be read', async () => {
  const real = fakeBackend('real');
  const loadDemo = jest.fn();
  const backend = switchBackend(real.backend, {
    savedCredentials: () => Promise.reject(new Error('cofre')),
    loadDemo,
  });
  await expect(backend.records.getGrades()).resolves.toBe('real');
  expect(loadDemo).not.toHaveBeenCalled();
});
