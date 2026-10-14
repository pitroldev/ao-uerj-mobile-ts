import { Linking } from 'react-native';
import type { LinkingOptions } from '@react-navigation/native';
import {
  demoCredentials,
  isDemoScenario,
  type DemoScenario,
} from '@root/adapters/outbound/demo';
import { normalizeSubjectId } from '@root/modules/academics/domain/rules/subjectId';
import type { RootDrawerParamList } from '@root/routes';
import type { AppServices } from '../composition/createAppServices';

/**
 * Deep links de DEBUG (scheme registrado só em android/app/src/debug).
 *
 *   aouerj-dev://demo[/<cenário>]   entra na conta de demonstração
 *   aouerj-dev://inicio | progresso | gerador | mural | realizadas |
 *                curriculo | universais | pesquisa[/<código>] | sobre
 */
export const DEV_LINK_PREFIX = 'aouerj-dev://';

const DEV_ROUTE_PATHS = {
  Início: 'inicio',
  Mapa: 'mapa/:location?',
  'Meu Progresso': 'progresso',
  'Gerador de Grade': 'gerador',
  'Mural de Mensagens': 'mural',
  'Disciplinas Realizadas': 'realizadas',
  'Disciplinas do Currículo': 'curriculo',
  'Disciplinas Universais': 'universais',
  'Pesquisa de Disciplinas': 'pesquisa/:subjectId?',
  Sobre: 'sobre',
  Login: 'login',
} as const;

/** React Navigation decodes the segment before calling this parser. */
function subjectParam(value: string) {
  try {
    return normalizeSubjectId(value);
  } catch {
    // The screen reports invalid codes itself.
    return value;
  }
}

export const devLinkingConfig: LinkingOptions<RootDrawerParamList>['config'] = {
  screens: {
    ...DEV_ROUTE_PATHS,
    'Pesquisa de Disciplinas': {
      path: DEV_ROUTE_PATHS['Pesquisa de Disciplinas'],
      parse: { subjectId: subjectParam },
    },
  },
};

/**
 * `undefined`: not a demo link. `null`: demo link with an unknown scenario.
 */
export function parseDemoLink(url: string): DemoScenario | null | undefined {
  if (!url.toLowerCase().startsWith(DEV_LINK_PREFIX)) return undefined;
  const path = url
    .slice(DEV_LINK_PREFIX.length)
    .split(/[?#]/)[0]
    .replace(/\/+$/, '');
  const match = /^demo(?:\/([a-z-]+))?$/i.exec(path);
  if (!match) return undefined;
  const scenario = (match[1] ?? 'padrao').toLowerCase();
  return isDemoScenario(scenario) ? scenario : null;
}

type LinkSource = Pick<typeof Linking, 'getInitialURL' | 'addEventListener'>;
type DevLinkServices = Pick<AppServices, 'identity' | 'demo' | 'initialize'>;

/** Signs into the demo account unless that scenario is already signed in. */
async function signInDemo(
  services: DevLinkServices,
  scenario: DemoScenario,
): Promise<'signed-in' | 'already-signed-in'> {
  if (!services.demo) throw new Error('Modo demonstração indisponível.');
  await services.initialize();
  const { status } = services.identity.getSnapshot();
  const signedIn = status === 'signedIn' || status === 'refreshing';
  if (signedIn && services.demo.activeScenario() === scenario)
    return 'already-signed-in';
  await services.identity.signIn(demoCredentials(scenario));
  return 'signed-in';
}

export function createDevLinking(
  services: DevLinkServices,
  source: LinkSource = Linking,
): LinkingOptions<RootDrawerParamList> {
  const handle = (url: string, forward: (next: string) => void) => {
    const scenario = parseDemoLink(url);
    if (scenario === undefined) {
      forward(url);
      return;
    }
    if (scenario === null) {
      console.warn(`[demo] Cenário desconhecido em ${url}`);
      return;
    }
    signInDemo(services, scenario)
      .then(result => {
        // A fresh sign-in already lands on Início.
        if (result === 'already-signed-in')
          forward(`${DEV_LINK_PREFIX}${DEV_ROUTE_PATHS.Início}`);
      })
      .catch(error =>
        console.warn('[demo] Falha no login de demonstração', error),
      );
  };

  return {
    prefixes: [DEV_LINK_PREFIX],
    config: devLinkingConfig,
    async getInitialURL() {
      const url = await source.getInitialURL();
      if (url && parseDemoLink(url) !== undefined) {
        handle(url, () => undefined);
        return null;
      }
      return url;
    },
    subscribe(listener) {
      const subscription = source.addEventListener('url', ({ url }) =>
        handle(url, listener),
      );
      return () => subscription.remove();
    },
  };
}
