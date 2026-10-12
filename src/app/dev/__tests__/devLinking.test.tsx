import { demoCredentials } from '@root/adapters/outbound/demo';
import type { IdentityState } from '@root/modules/identity/domain/types';
import {
  createDevLinking,
  devLinkingConfig,
  DEV_LINK_PREFIX,
  parseDemoLink,
} from '../devLinking';

type UrlListener = (event: { url: string }) => void;

function setup({
  status = 'signedOut' as IdentityState['status'],
  activeScenario = null as string | null,
  initialURL = null as string | null,
} = {}) {
  const listeners = new Set<UrlListener>();
  const source = {
    getInitialURL: jest.fn(async () => initialURL),
    addEventListener: jest.fn((_type: 'url', listener: UrlListener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    }),
  };
  const services = {
    initialize: jest.fn(async () => null),
    identity: {
      getSnapshot: jest.fn(
        (): IdentityState => ({ status, account: null, error: null }),
      ),
      signIn: jest.fn(async () => undefined),
    },
    demo: { activeScenario: jest.fn(() => activeScenario) },
  };
  const linking = createDevLinking(
    services as unknown as Parameters<typeof createDevLinking>[0],
    source as unknown as Parameters<typeof createDevLinking>[1],
  );
  const open = (url: string) =>
    listeners.forEach(listener => listener({ url }));
  return { linking, services, open, listeners };
}

const flush = () => new Promise(resolve => setImmediate(resolve));
const screens = devLinkingConfig!.screens as Record<
  string,
  string | { path: string; parse: { subjectId: (value: string) => string } }
>;

it('accepts only the debug scheme', () => {
  expect(setup().linking.prefixes).toEqual(['aouerj-dev://']);
});

it.each([
  ['Início', 'inicio'],
  ['Meu Progresso', 'progresso'],
  ['Gerador de Grade', 'gerador'],
  ['Mural de Mensagens', 'mural'],
  ['Disciplinas Realizadas', 'realizadas'],
  ['Disciplinas do Currículo', 'curriculo'],
  ['Disciplinas Universais', 'universais'],
  ['Sobre', 'sobre'],
])('maps the drawer route %s to %s', (name, path) => {
  expect(screens[name]).toBe(path);
});

it('passes an optional, normalized subject code to the subject search', () => {
  const search = screens['Pesquisa de Disciplinas'];
  if (typeof search === 'string') throw new Error('missing parser');
  expect(search.path).toBe('pesquisa/:subjectId?');
  expect(search.parse.subjectId('IME02-10892')).toBe('10892');
  expect(search.parse.subjectId('abc')).toBe('abc');
});

it.each([
  ['aouerj-dev://demo', 'padrao'],
  ['aouerj-dev://demo/', 'padrao'],
  ['aouerj-dev://demo/rid', 'rid'],
  ['AOUERJ-DEV://Demo/Bloqueado', 'bloqueado'],
  ['aouerj-dev://demo/xyz', null],
  ['aouerj-dev://inicio', undefined],
  ['aouerj-dev://demonstracao', undefined],
  ['https://demo', undefined],
])('parses %s as demo scenario %p', (url, expected) => {
  expect(parseDemoLink(url)).toBe(expected);
});

it('forwards route links to React Navigation', () => {
  const { linking, open } = setup();
  const listener = jest.fn();
  const unsubscribe = linking.subscribe!(listener);
  open(`${DEV_LINK_PREFIX}sobre`);
  expect(listener).toHaveBeenCalledWith('aouerj-dev://sobre');
  unsubscribe?.();
  open(`${DEV_LINK_PREFIX}inicio`);
  expect(listener).toHaveBeenCalledTimes(1);
});

it('signs into the requested demo scenario without forwarding the link', async () => {
  const { linking, open, services } = setup();
  const listener = jest.fn();
  linking.subscribe!(listener);
  open('aouerj-dev://demo/rid');
  await flush();
  expect(services.initialize).toHaveBeenCalled();
  expect(services.identity.signIn).toHaveBeenCalledWith(demoCredentials('rid'));
  expect(listener).not.toHaveBeenCalled();
});

it('only navigates home when that demo scenario is already signed in', async () => {
  const { linking, open, services } = setup({
    status: 'signedIn',
    activeScenario: 'padrao',
  });
  const listener = jest.fn();
  linking.subscribe!(listener);
  open('aouerj-dev://demo');
  await flush();
  expect(services.identity.signIn).not.toHaveBeenCalled();
  expect(listener).toHaveBeenCalledWith('aouerj-dev://inicio');
});

it('handles a demo link that cold-starts the app', async () => {
  const { linking, services } = setup({ initialURL: 'aouerj-dev://demo' });
  await expect(linking.getInitialURL!()).resolves.toBeNull();
  await flush();
  expect(services.identity.signIn).toHaveBeenCalledWith(demoCredentials());
});

it('keeps other initial links for React Navigation', async () => {
  const { linking } = setup({ initialURL: 'aouerj-dev://progresso' });
  await expect(linking.getInitialURL!()).resolves.toBe(
    'aouerj-dev://progresso',
  );
});

it('ignores unknown demo scenarios', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { linking, open, services } = setup();
  linking.subscribe!(jest.fn());
  open('aouerj-dev://demo/xyz');
  await flush();
  expect(services.identity.signIn).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});
