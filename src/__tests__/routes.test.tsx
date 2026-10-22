import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  CommonActions,
  createNavigationContainerRef,
  NavigationContainer,
} from '@react-navigation/native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import type { IdentityState } from '@root/modules/identity/domain/types';
import { renderWithProviders } from '@root/test-utils/render';
import { MainRoutes, type RootDrawerParamList } from '../routes';

let mockIdentity: IdentityState;
let mockNotifications = { supported: true };

jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useIdentity: () => mockIdentity,
  useAppServices: () => ({
    notifications: { settings: { getSnapshot: () => mockNotifications } },
  }),
}));
jest.mock('@root/app/splash', () => ({ hideSplash: jest.fn() }));
jest.mock('@root/components/templates/CustomDrawerNavigator', () => ({
  DrawerNavigator: () => null,
}));
jest.mock('@root/modules/delivery/presentation/FeatureGate', () => ({
  FeatureGate: ({ children }: React.PropsWithChildren) => children,
}));

// Keep React Navigation's router, groups, route keys and state transitions.
// Only replace the animated native drawer view with its focused screen.
jest.mock('@react-navigation/drawer', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { createNavigatorFactory, DrawerRouter, useNavigationBuilder } =
    jest.requireActual<typeof import('@react-navigation/native')>(
      '@react-navigation/native',
    );
  function TestDrawerNavigator(
    props: Parameters<typeof useNavigationBuilder>[1],
  ) {
    'use no memo';
    const { state, descriptors, NavigationContent } = useNavigationBuilder(
      DrawerRouter,
      props,
    );
    return React.createElement(
      NavigationContent,
      null,
      descriptors[state.routes[state.index].key].render(),
    );
  }
  return {
    createDrawerNavigator: createNavigatorFactory(TestDrawerNavigator),
  };
});

function MockPage({ route }: { route: { name: string } }) {
  const [visits, setVisits] = useState(0);
  return (
    <View>
      <Text>{`Tela: ${route.name}`}</Text>
      <Text>{`Visitas: ${visits}`}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Alterar estado da tela"
        onPress={() => setVisits(value => value + 1)}
      >
        <Text>Alterar</Text>
      </Pressable>
    </View>
  );
}

jest.mock('@root/pages/Login', () => ({ LoginPage: MockPage }));
jest.mock('@root/pages/Home', () => ({ HomePage: MockPage }));
jest.mock('@root/pages/MyProgress', () => ({ MyProgressPage: MockPage }));
jest.mock('@root/pages/Documents', () => ({ DocumentsPage: MockPage }));
jest.mock('@root/pages/ScheduleSimulator', () => ({
  ScheduleCreationPage: MockPage,
}));
jest.mock('@root/pages/MessageBoard', () => ({ MessageBoard: MockPage }));
jest.mock('@root/pages/SubjectsTaken', () => ({
  SubjectsTakenScreen: MockPage,
}));
jest.mock('@root/pages/CurriculumSubjects', () => ({
  CurriculumSubjects: MockPage,
}));
jest.mock('@root/pages/UniversalSubjects', () => ({
  UniversalSubjects: MockPage,
}));
jest.mock('@root/pages/SubjectDetails', () => ({
  SubjectDetailPage: MockPage,
}));
jest.mock('@root/pages/About', () => ({ AboutPage: MockPage }));
jest.mock('@root/pages/Notifications', () => ({
  NotificationsPage: MockPage,
}));
jest.mock('@root/pages/Loading', () => ({ LoadingPage: MockPage }));
jest.mock('@root/pages/CampusMap/CampusMap', () => ({
  CampusMapPage: MockPage,
}));

const signedOut: IdentityState = {
  status: 'signedOut',
  account: null,
  error: null,
};
const signedIn: IdentityState = {
  status: 'signedIn',
  account: {
    scope: 'student-a',
    matricula: '202600000000',
    name: 'Estudante de teste',
    period: '2026.2',
  },
  error: null,
};

async function setup(identity = signedOut, notifications = true) {
  mockIdentity = identity;
  mockNotifications = { supported: notifications };
  const navigation = createNavigationContainerRef<RootDrawerParamList>();
  const unhandled = jest.fn();
  const tree = () => (
    <NavigationContainer ref={navigation} onUnhandledAction={unhandled}>
      <MainRoutes />
    </NavigationContainer>
  );
  const rendered = await renderWithProviders(tree());
  return {
    navigation,
    unhandled,
    async changeIdentity(next: IdentityState) {
      mockIdentity = next;
      await rendered.rerender(tree());
    },
  };
}

describe('MainRoutes authorization', () => {
  it('offers Notificações to the signed-in account where the device supports it', async () => {
    const { navigation, changeIdentity } = await setup(signedIn);
    await act(() => navigation.navigate('Notificações'));
    expect(screen.getByText('Tela: Notificações')).toBeOnTheScreen();
    await changeIdentity(signedOut);
    expect(navigation.getRootState()?.routeNames).not.toContain('Notificações');
  });

  it('leaves Notificações out without the native module (iOS)', async () => {
    const { navigation } = await setup(signedIn, false);
    expect(navigation.getRootState()?.routeNames).not.toContain('Notificações');
  });

  it('exposes documents only to the signed-in account and drops it on sign out', async () => {
    const { navigation, changeIdentity, unhandled } = await setup(signedIn);
    await act(() => navigation.navigate('Emissão de Documentos'));
    expect(screen.getByText('Tela: Emissão de Documentos')).toBeOnTheScreen();
    await changeIdentity(signedOut);
    expect(navigation.getRootState()?.routeNames).not.toContain(
      'Emissão de Documentos',
    );
    await act(() =>
      navigation.dispatch(CommonActions.navigate('Emissão de Documentos')),
    );
    expect(unhandled).toHaveBeenCalledTimes(1);
    expect(navigation.getCurrentRoute()?.name).toBe('Login');
  });
  it('lets a guest open only Login and Mapa, with Back returning to Login', async () => {
    const { navigation, unhandled } = await setup();
    expect(navigation.getRootState()?.routeNames).toEqual(['Login', 'Mapa']);
    expect(screen.getByText('Tela: Login')).toBeOnTheScreen();

    await act(() => navigation.navigate('Mapa'));
    expect(screen.getByText('Tela: Mapa')).toBeOnTheScreen();
    await act(() => navigation.goBack());
    expect(screen.getByText('Tela: Login')).toBeOnTheScreen();

    await act(() => navigation.dispatch(CommonActions.navigate('Início')));
    await act(() =>
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Meu Progresso' }],
        }),
      ),
    );
    expect(unhandled).toHaveBeenCalledTimes(2);
    expect(navigation.getCurrentRoute()?.name).toBe('Login');
  });

  it('drops private routes, map parameters and screen state when signing out', async () => {
    const { navigation, changeIdentity, unhandled } = await setup(signedIn);
    expect(navigation.getCurrentRoute()?.name).toBe('Início');
    await act(() => navigation.navigate('Mapa', { location: '6019 B' }));
    const signedInMapKey = navigation.getCurrentRoute()?.key;
    await fireEvent.press(screen.getByRole('button'));
    expect(screen.getByText('Visitas: 1')).toBeOnTheScreen();

    await changeIdentity(signedOut);
    expect(navigation.getRootState()?.routeNames).toEqual(['Login', 'Mapa']);
    const guestMap = navigation
      .getRootState()
      ?.routes.find(route => route.name === 'Mapa');
    expect(guestMap?.key).not.toBe(signedInMapKey);
    expect(guestMap?.params).toBeUndefined();
    await act(() => navigation.navigate('Mapa'));
    expect(navigation.getCurrentRoute()?.key).not.toBe(signedInMapKey);
    expect(navigation.getCurrentRoute()?.params).toBeUndefined();
    expect(screen.getByText('Visitas: 0')).toBeOnTheScreen();
    await act(() =>
      navigation.dispatch(CommonActions.navigate('Meu Progresso')),
    );
    expect(unhandled).toHaveBeenCalledTimes(1);
    expect(navigation.getCurrentRoute()?.name).toBe('Mapa');
    await act(() => navigation.goBack());
    expect(navigation.getCurrentRoute()?.name).toBe('Login');
    expect(navigation.canGoBack()).toBe(false);
  });

  it('replaces the guest map with a fresh signed-in route group', async () => {
    const { navigation, changeIdentity } = await setup();
    await act(() => navigation.navigate('Mapa', { location: '9023 D' }));
    const guestMapKey = navigation.getCurrentRoute()?.key;
    await fireEvent.press(screen.getByRole('button'));
    expect(screen.getByText('Visitas: 1')).toBeOnTheScreen();

    await changeIdentity(signedIn);
    const signedInMap = navigation
      .getRootState()
      ?.routes.find(route => route.name === 'Mapa');
    expect(signedInMap?.key).not.toBe(guestMapKey);
    expect(signedInMap?.params).toBeUndefined();
    expect(navigation.getRootState()?.routeNames).not.toContain('Login');
    expect(navigation.getRootState()?.routeNames).toContain('Meu Progresso');
    await act(() => navigation.navigate('Mapa'));
    expect(navigation.getCurrentRoute()?.key).not.toBe(guestMapKey);
    expect(navigation.getCurrentRoute()?.params).toBeUndefined();
    expect(screen.getByText('Visitas: 0')).toBeOnTheScreen();
  });

  it('exposes only Loading while the saved account is not read yet', async () => {
    const { navigation, unhandled, changeIdentity } = await setup({
      ...signedOut,
      status: 'restoring',
    });
    expect(navigation.getRootState()?.routeNames).toEqual(['Loading']);
    expect(screen.getByText('Tela: Loading')).toBeOnTheScreen();
    await act(() => navigation.dispatch(CommonActions.navigate('Mapa')));
    expect(unhandled).toHaveBeenCalledTimes(1);
    expect(navigation.getCurrentRoute()?.name).toBe('Loading');

    await changeIdentity(signedOut);
    expect(navigation.getRootState()?.routeNames).toEqual(['Login', 'Mapa']);
    expect(navigation.getCurrentRoute()?.name).toBe('Login');
    expect(navigation.canGoBack()).toBe(false);
  });

  it('opens the saved account right away while the opening sign-in runs', async () => {
    const { navigation, changeIdentity } = await setup({
      ...signedIn,
      status: 'restoring',
    });
    expect(navigation.getCurrentRoute()?.name).toBe('Início');
    await act(() => navigation.navigate('Meu Progresso'));
    const progressKey = navigation.getCurrentRoute()?.key;

    // o login termina: a mesma navegação segue, sem remontar as telas
    await changeIdentity(signedIn);
    expect(navigation.getCurrentRoute()?.key).toBe(progressKey);

    // a senha mudou no portal: volta ao login
    await changeIdentity(signedOut);
    expect(navigation.getCurrentRoute()?.name).toBe('Login');
  });

  it('keeps private navigation during refresh but requires an account', async () => {
    const { navigation, changeIdentity } = await setup({
      ...signedIn,
      status: 'refreshing',
    });
    await act(() => navigation.navigate('Meu Progresso'));
    expect(screen.getByText('Tela: Meu Progresso')).toBeOnTheScreen();

    await changeIdentity({ ...signedOut, status: 'signedIn' });
    expect(navigation.getRootState()?.routeNames).toEqual(['Login', 'Mapa']);
    expect(navigation.getCurrentRoute()?.name).toBe('Login');
  });
});
