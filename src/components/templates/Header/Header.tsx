import React from 'react';
import { StatusBar } from 'react-native';
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

/**
 * Cabeçalho global azul (fora do navegador: fica parado enquanto o conteúdo
 * desliza com o menu). Menu ou voltar à esquerda, título centralizado (no
 * Início, o período) e o logo AO à direita, que abre "Sobre".
 */
const Header = ({ navigationState }: Props) => {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { account } = useIdentity();
  const { onBack, backLabel } = useHeaderState();

  const currentRoute = RootNavigation.isNavigationReady()
    ? RootNavigation.getCurrentRouteName()
    : undefined;

  const isSignedIn =
    Boolean(account) && currentRoute !== 'Login' && Boolean(currentRoute);

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

  const statusBar = (
    <StatusBar
      barStyle="light-content"
      backgroundColor={theme.colors.brand}
      animated
    />
  );

  if (!isSignedIn) {
    return statusBar;
  }

  const showBack = Boolean(onBack) && !isDrawerOpen;

  return (
    <Container $top={insets.top}>
      {statusBar}
      {showBack ? (
        <IconButton
          icon="arrow_back"
          onBrand
          accessibilityLabel={backLabel}
          onPress={() => onBack?.()}
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
        onPress={() => RootNavigation.navigate('Sobre')}
        accessibilityRole="button"
        accessibilityLabel="Sobre o AO UERJ"
        style={({ pressed }) =>
          pressed && { backgroundColor: theme.colors.onBrandPressed }
        }
      >
        <AoLogo width={36} accessibilityLabel={null} />
      </LogoButton>
    </Container>
  );
};

export default Header;
