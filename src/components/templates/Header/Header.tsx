import React from 'react';
import type { NavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'styled-components/native';
import { AntDesign as Icon } from '@react-native-vector-icons/ant-design';

import { useIdentity } from '@root/app/providers/AppServicesProvider';
import * as RootNavigation from '@services/rootNavigation';

import Text from '@atoms/Text';
import {
  Container,
  MenuButton,
  Button,
  AOButton,
  LogoAO,
} from './Header.styles';

type Props = {
  navigationState?: NavigationState;
};

const Header = ({ navigationState }: Props) => {
  const insets = useSafeAreaInsets();

  const theme = useTheme();
  const { account } = useIdentity();

  // Use optional chaining and provide a fallback
  const currentRoute = RootNavigation.isNavigationReady()
    ? RootNavigation.getCurrentRouteName()
    : undefined;

  const isSignedIn =
    Boolean(account) && currentRoute !== 'Login' && Boolean(currentRoute);

  const isDrawerOpen = navigationState?.history?.some(
    item =>
      typeof item === 'object' &&
      item !== null &&
      'type' in item &&
      item.type === 'drawer',
  );

  const isAtHome = currentRoute === 'Início';
  const title = isAtHome
    ? account?.period === 'current'
      ? 'Período atual'
      : account?.period
    : currentRoute;

  if (!isSignedIn) {
    return null;
  }

  return (
    <Container style={{ paddingTop: insets.top }}>
      <MenuButton onPress={RootNavigation.toggleDrawer}>
        <Icon
          name={isDrawerOpen ? 'menu-unfold' : 'menu-fold'}
          color={theme.COLORS.BACKGROUND}
          size={25}
        />
      </MenuButton>
      <Button onPress={RootNavigation.toggleDrawer}>
        <Text
          weight="300"
          size="XL"
          color="BACKGROUND"
          marginLeft="auto"
          marginRight="auto"
        >
          {title}
        </Text>
      </Button>
      <AOButton onPress={() => RootNavigation.navigate('Sobre')}>
        <LogoAO width={36} height={36} />
      </AOButton>
    </Container>
  );
};

export default Header;
