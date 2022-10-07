/* eslint-disable react-native/no-inline-styles */
import React, {useRef, useState, useLayoutEffect} from 'react';
import {Animated, LayoutChangeEvent} from 'react-native';
import {DrawerContentComponentProps} from '@react-navigation/drawer';

import * as apiConfigReducer from '@reducers/apiConfig';
import * as userInfoReducer from '@reducers/userInfo';
import {useAppDispatch, useAppSelector} from '@root/store';
import {LIGHT} from '@root/themes';
import {
  Container,
  Text,
  Button,
  ButtonLogout,
  ScrollView,
} from './CustomDrawerNavigator.styles';

const DrawerNavigator = ({state, navigation}: DrawerContentComponentProps) => {
  const [highlighterHeight, setHeight] = useState(34);

  const dispatch = useAppDispatch();
  const {cookies} = useAppSelector(apiConfigReducer.selectApiConfig);
  const isSignedIn = Boolean(cookies);

  const {routeNames} = state;
  const highlighterPositionY = useRef(new Animated.Value(61)).current;
  const routePositions = useRef([]).current as unknown as Partial<
    LayoutChangeEvent['nativeEvent']['layout']
  >[];

  useLayoutEffect(() => {
    const key: number = state.index;

    const layout = routePositions[key];
    if (layout) {
      setHeight(layout.height as number);
      Animated.timing(highlighterPositionY, {
        toValue: layout ? (layout.y as number) : 61.1429,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [state, highlighterPositionY, routePositions]);

  if (!isSignedIn) {
    return <Container />;
  }

  function onLayout(event: LayoutChangeEvent, key: number) {
    const {y, height} = event.nativeEvent.layout;
    if (key === 0) {
      setHeight(height);
      Animated.timing(highlighterPositionY, {
        toValue: y,
        duration: 0,
        useNativeDriver: true,
      }).start();
    }
    routePositions.push({y, height});
  }

  function handleLogout() {
    dispatch(apiConfigReducer.clear());
    dispatch(userInfoReducer.clear());
    navigation.toggleDrawer();
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
              transform: [{translateY: highlighterPositionY}],
              height: highlighterHeight,
            },
          ]}
        />
        {routeNames.map((route: string, key: number) => {
          if (route === 'Informações da Disciplina') {
            return;
          }
          return (
            <Button
              key={key}
              onLayout={event => onLayout(event, key)}
              onPress={() => navigation.navigate(route)}>
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
