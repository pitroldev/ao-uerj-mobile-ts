import { getStateFromPath } from '@react-navigation/native';
import { loadDevLinking } from '../index';
import {
  createDevLinking,
  devLinkingConfig,
  DEV_LINK_PREFIX,
} from '../devLinking';

type UrlListener = (event: { url: string }) => void;

function setup(initialURL: string | null = null) {
  const listeners = new Set<UrlListener>();
  const source = {
    getInitialURL: jest.fn(async () => initialURL),
    addEventListener: jest.fn((_type: 'url', listener: UrlListener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    }),
  };
  const linking = createDevLinking(source);
  const open = (url: string) =>
    listeners.forEach(listener => listener({ url }));
  return { linking, source, open };
}

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
  ['Plano até a formatura', 'plano'],
  ['Emissão de Documentos', 'documentos'],
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

it('forwards route links to React Navigation and releases its listener', () => {
  const { linking, open } = setup();
  const listener = jest.fn();
  const unsubscribe = linking.subscribe!(listener);
  open(`${DEV_LINK_PREFIX}sobre`);
  expect(listener).toHaveBeenCalledWith('aouerj-dev://sobre');
  unsubscribe?.();
  open(`${DEV_LINK_PREFIX}inicio`);
  expect(listener).toHaveBeenCalledTimes(1);
});

it('keeps initial links for React Navigation', async () => {
  const { linking } = setup('aouerj-dev://progresso');
  await expect(linking.getInitialURL!()).resolves.toBe(
    'aouerj-dev://progresso',
  );
});

it('does not invent a route when there is no initial link', async () => {
  await expect(setup().linking.getInitialURL!()).resolves.toBeNull();
});

it.each(['demo', 'demo/padrao', 'demo/rid', 'demo?password=demo'])(
  'does not recognize the removed automatic login path %s',
  path => {
    expect(getStateFromPath(path, devLinkingConfig)).toBeUndefined();
  },
);

describe('loadDevLinking', () => {
  const globals = globalThis as { __DEV__?: boolean };
  const original = globals.__DEV__;
  afterEach(() => {
    globals.__DEV__ = original;
  });

  it('only provides navigation links during development', () => {
    globals.__DEV__ = true;
    expect(loadDevLinking()?.config).toEqual(devLinkingConfig);
    globals.__DEV__ = false;
    expect(loadDevLinking()).toBeUndefined();
  });
});
