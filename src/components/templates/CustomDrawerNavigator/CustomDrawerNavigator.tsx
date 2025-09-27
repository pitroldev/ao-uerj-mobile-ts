import React, { useRef, useState, useLayoutEffect } from 'react';
import { Animated, LayoutChangeEvent } from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';

import queryClient from '@services/query-client';

import { useAppDispatch, useAppSelector } from '@root/store';
import * as apiConfigReducer from '@reducers/apiConfig';
import * as userInfoReducer from '@reducers/userInfo';

import { LIGHT } from '@root/themes';

import {
  Container,
  Text,
  Button,
  ButtonLogout,
  ScrollView,
} from './CustomDrawerNavigator.styles';

const DrawerNavigator = ({
  state,
  navigation,
}: DrawerContentComponentProps) => {
  const [highlighterHeight, setHeight] = useState(34);

  const dispatch = useAppDispatch();
  const { cookies } = useAppSelector(apiConfigReducer.selectApiConfig);
  const isSignedIn = Boolean(cookies);

  const { routeNames } = state;
  const highlighterPositionY = useRef(new Animated.Value(61)).current;
  const routePositions = useRef([]).current as unknown as Partial<
    LayoutChangeEvent['nativeEvent']['layout']
  >[];

  const visibleRoutes = routeNames.filter(
    route => route !== 'Informações da Disciplina',
  );
  const currentRouteName = routeNames[state.index];

  useLayoutEffect(() => {
    const visibleIndex = visibleRoutes.findIndex(
      route => route === currentRouteName,
    );

    if (visibleIndex !== -1) {
      const layout = routePositions[visibleIndex];
      if (layout) {
        setHeight(layout.height as number);
        Animated.timing(highlighterPositionY, {
          toValue: layout ? (layout.y as number) : 61.1429,
          duration: 150,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [
    state,
    highlighterPositionY,
    routePositions,
    currentRouteName,
    visibleRoutes,
  ]);

  if (!isSignedIn) {
    return <Container />;
  }

  function onLayout(event: LayoutChangeEvent, key: number) {
    const { y, height } = event.nativeEvent.layout;

    routePositions[key] = { y, height };

    const currentVisibleIndex = visibleRoutes.findIndex(
      route => route === currentRouteName,
    );
    if (key === 0 || key === currentVisibleIndex) {
      setHeight(height);
      Animated.timing(highlighterPositionY, {
        toValue: y,
        duration: key === 0 ? 0 : 150,
        useNativeDriver: true,
      }).start();
    }
  }

  function handleLogout() {
    dispatch(apiConfigReducer.clear());
    dispatch(userInfoReducer.clear());
    navigation.toggleDrawer();
    queryClient.clear();
  }

  return (
    <Container>
      <ScrollView>
        <Animated.View
          style={[
            {
              backgroundColor: LIGHT.COLORS.SECONDARY,
              width: 600,
              position: 'absolute',
            },
            {
              transform: [{ translateY: highlighterPositionY }],
              height: highlighterHeight,
            },
          ]}
        />
        {visibleRoutes.map((route: string, key: number) => {
          return (
            <Button
              key={key}
              onLayout={event => onLayout(event, key)}
              onPress={() => navigation.navigate(route)}
            >
              <Text>{route}</Text>
            </Button>
          );
        })}
      </ScrollView>
      <ButtonLogout onPress={handleLogout}>
        <Text>Sair</Text>
      </ButtonLogout>
    </Container>
  );
};

export default DrawerNavigator;
