import { Linking } from 'react-native';
import type { LinkingOptions } from '@react-navigation/native';
import { normalizeSubjectId } from '@root/modules/academics/domain/rules/subjectId';
import type { RootDrawerParamList } from '@root/routes';

/**
 * Deep links de DEBUG (scheme registrado só em android/app/src/debug).
 *
 *   aouerj-dev://inicio | progresso | gerador | mural | realizadas |
 *                curriculo | universais | pesquisa[/<código>] | documentos |
 *                notificacoes | sobre
 */
export const DEV_LINK_PREFIX = 'aouerj-dev://';

const DEV_ROUTE_PATHS = {
  Início: 'inicio',
  Mapa: 'mapa/:location?',
  'Meu Progresso': 'progresso',
  'Emissão de Documentos': 'documentos',
  'Gerador de Grade': 'gerador',
  'Mural de Mensagens': 'mural',
  'Disciplinas Realizadas': 'realizadas',
  'Disciplinas do Currículo': 'curriculo',
  'Disciplinas Universais': 'universais',
  'Pesquisa de Disciplinas': 'pesquisa/:subjectId?',
  Notificações: 'notificacoes',
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

type LinkSource = Pick<typeof Linking, 'getInitialURL' | 'addEventListener'>;

export function createDevLinking(
  source: LinkSource = Linking,
): LinkingOptions<RootDrawerParamList> {
  return {
    prefixes: [DEV_LINK_PREFIX],
    config: devLinkingConfig,
    getInitialURL: () => source.getInitialURL(),
    subscribe(listener) {
      const subscription = source.addEventListener('url', ({ url }) =>
        listener(url),
      );
      return () => subscription.remove();
    },
  };
}
