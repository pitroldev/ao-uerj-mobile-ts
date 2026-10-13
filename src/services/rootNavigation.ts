import type { RefObject } from 'react';
import { Keyboard } from 'react-native';

import type { RootDrawerParamList } from '@root/routes';
import {
  DrawerActions,
  NavigationContainerRef,
} from '@react-navigation/native';

type Container = NavigationContainerRef<RootDrawerParamList>;

/** Container de cada raiz montada do app, da mais antiga para a mais nova. */
let containers: RefObject<Container | null>[] = [];

/**
 * Registra o container de uma raiz do app e devolve a função que o retira.
 * Recriar a atividade (mudar a fonte ou a navegação do sistema) pode montar a
 * raiz nova antes de desmontar a antiga. As ações vão sempre para a mais nova
 * e a saída da antiga não as desliga: com uma ref única, a desmontagem da raiz
 * antiga a zerava, e o menu e o logo do cabeçalho paravam de responder.
 */
export function registerNavigationContainer(
  ref: RefObject<Container | null>,
): () => void {
  containers = [...containers, ref];
  return () => {
    containers = containers.filter(item => item !== ref);
  };
}

/** Container da raiz mais nova, a que está na tela. */
function current(): Container | null {
  return containers[containers.length - 1]?.current ?? null;
}

export function isNavigationReady(): boolean {
  return current()?.isReady() ?? false;
}

export function navigate(name: any, params?: any) {
  if (isNavigationReady()) {
    current()?.navigate(name, params);
  }
}

/**
 * Abre ou fecha o menu pelo cabeçalho. A lib do menu só recolhe o teclado no
 * arraste; aberto pelo botão, o teclado de uma busca ficaria por cima do pé do
 * menu (Sobre, Sair e o tema), já que a janela de ponta a ponta não encolhe.
 */
export function toggleDrawer() {
  if (isNavigationReady()) {
    Keyboard.dismiss();
    current()?.dispatch(DrawerActions.toggleDrawer());
  }
}

export function getCurrentRouteName() {
  if (isNavigationReady()) {
    return current()?.getCurrentRoute()?.name;
  }
  return undefined;
}
