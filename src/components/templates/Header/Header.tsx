import React from 'react';
import { Keyboard, StatusBar } from 'react-native';
import type { NavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'styled-components/native';

import { useIdentity } from '@root/app/providers/AppServicesProvider';
import * as RootNavigation from '@services/rootNavigation';
import { AoLogo } from '@components/ui/AoLogo';
import { IconButton } from '@components/ui/Button';

import { useHeaderState } from './headerStore';
import { Container, LogoButton, Title, TitleButton } from './Header.styles';

type Props = {
  navigationState?: NavigationState;
};

type RouteLike = {
  name: string;
  state?: { index?: number; routes: RouteLike[] };
};

/** Nome da rota ativa (a mais interna), como `getCurrentRoute()`. */
function activeRouteName(state: NavigationState | undefined) {
  let route: RouteLike | undefined = state?.routes[state.index];
  while (route?.state) {
    route = route.state.routes[route.state.index ?? 0];
  }
  return route?.name;
}

/**
 * Cabeçalho global azul (fora do navegador: fica parado enquanto o conteúdo
 * desliza com o menu). Menu ou voltar à esquerda, título centralizado (no
 * Início, o período) e o logo AO à direita, que abre "Sobre".
 */
export const Header = ({ navigationState }: Props) => {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { account } = useIdentity();
  const { onBack, backLabel } = useHeaderState();

  // Vem do estado recebido por props, e não da ref do container: o React
  // Compiler memoriza chamadas sem dependências reativas, e o título ficava
  // preso na primeira rota ("Loading" ou "Login").
  const currentRoute = activeRouteName(navigationState);

  const isSignedIn =
    Boolean(account) && currentRoute !== 'Login' && Boolean(currentRoute);
  const isGuestMap = !account && currentRoute === 'Mapa';

  const isDrawerOpen = Boolean(
    navigationState?.history?.some(
      item =>
        typeof item === 'object' &&
        item !== null &&
        'type' in item &&
        item.type === 'drawer',
    ),
  );

  const isAtHome = currentRoute === 'Início';
  const title = isAtHome
    ? account?.period === 'current'
      ? 'Período atual'
      : account?.period
    : currentRoute;

  // A barra de status é transparente (de ponta a ponta em todas as versões):
  // o azul por trás dela é o deste cabeçalho, ou o topo do Login e do
  // Carregando antes de entrar. Por isso os ícones ficam sempre claros.
  const statusBar = <StatusBar barStyle="light-content" animated />;

  if (!isSignedIn && !isGuestMap) {
    return statusBar;
  }

  const showBack = isGuestMap || (Boolean(onBack) && !isDrawerOpen);

  return (
    <Container $top={insets.top}>
      {statusBar}
      {showBack ? (
        <IconButton
          icon="arrow_back"
          onBrand
          accessibilityLabel={isGuestMap ? 'Voltar para o login' : backLabel}
          onPress={() => {
            if (isGuestMap) {
              Keyboard.dismiss();
              RootNavigation.navigate('Login');
            } else {
              onBack?.();
            }
          }}
        />
      ) : (
        <IconButton
          icon={isDrawerOpen ? 'menu_open' : 'menu'}
          onBrand
          accessibilityLabel={isDrawerOpen ? 'Fechar menu' : 'Abrir menu'}
          accessibilityState={{ expanded: isDrawerOpen }}
          onPress={RootNavigation.toggleDrawer}
        />
      )}
      {/* tocar no título também abre/fecha o menu, como antes */}
      <TitleButton
        disabled={isGuestMap}
        onPress={RootNavigation.toggleDrawer}
        accessible={false}
        importantForAccessibility="no"
      >
        <Title
          variant="appBar"
          tone="onBrand"
          numberOfLines={1}
          accessibilityRole="header"
        >
          {title}
        </Title>
      </TitleButton>
      <LogoButton
        disabled={isGuestMap}
        accessible={!isGuestMap}
        importantForAccessibility={isGuestMap ? 'no-hide-descendants' : 'auto'}
        onPress={() => RootNavigation.navigate('Sobre')}
        accessibilityRole="button"
        accessibilityLabel={isGuestMap ? undefined : 'Sobre o AO UERJ'}
        style={({ pressed }) =>
          pressed && { backgroundColor: theme.colors.onBrandPressed }
        }
      >
        <AoLogo width={36} accessibilityLabel={null} />
      </LogoButton>
    </Container>
  );
};
