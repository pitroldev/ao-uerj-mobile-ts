import React, { useState, useEffect } from 'react';
import { useTheme } from 'styled-components';
import Icon from 'react-native-vector-icons/AntDesign';

import { useAppSelector } from '@root/store';
import * as infoReducer from '@reducers/userInfo';
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
  navigationState: any;
};

const Header = ({ navigationState }: Props) => {
  const [routeName, setRouteName] = useState('');

  const theme = useTheme();
  const { periodo, password } = useAppSelector(infoReducer.selectUserInfo);

  const currentRoute = RootNavigation.getCurrentRouteName();

  useEffect(() => {
    setRouteName(currentRoute ?? periodo ?? '');
  }, [navigationState]);

  const isSignedIn =
    Boolean(password) && currentRoute !== 'Login' && Boolean(currentRoute);

  const isDrawerOpen = navigationState?.history?.some(
    (it: any) => it.type === 'drawer',
  );

  const isAtHome = currentRoute === 'Início';
  const title = isAtHome ? periodo : routeName;

  if (!isSignedIn) {
    return null;
  }

  return (
    <Container>
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
        <LogoAO width={10} />
      </AOButton>
    </Container>
  );
};

export default Header;
