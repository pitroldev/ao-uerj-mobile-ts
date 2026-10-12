import React from 'react';
import { Text as RNText } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import { LIGHT } from '@root/themes';
import { Button, Text } from '@components/ui';
import ScreenPanel from '../ScreenPanel';
import Header from '../Header';
import { headerStore, useHeaderBack } from '../Header/headerStore';
import CustomDrawerNavigator from '../CustomDrawerNavigator';

const mockSignOut = jest.fn(() => Promise.resolve());
let mockRoute: string | undefined = 'Início';

jest.mock('react-native-modal', () => 'Modal');
jest.mock('@react-navigation/native', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useIdentity: () => ({
    status: 'signedIn',
    error: null,
    account: {
      scope: 's',
      name: 'Marina Albuquerque Teixeira',
      matricula: '202310045612',
      period: '2026.2',
    },
  }),
  useAppServices: () => ({ identity: { signOut: mockSignOut } }),
}));
jest.mock('@services/rootNavigation', () => ({
  isNavigationReady: () => true,
  getCurrentRouteName: () => mockRoute,
  toggleDrawer: jest.fn(),
  navigate: jest.fn(),
}));
const mockNavigation = jest.requireMock('@services/rootNavigation') as {
  toggleDrawer: jest.Mock;
  navigate: jest.Mock;
};
jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));

let renderer: ReactTestRenderer;
const render = async (node: React.ReactElement) => {
  await act(async () => {
    renderer = create(<ThemeProvider theme={LIGHT}>{node}</ThemeProvider>);
  });
};
const texts = () =>
  renderer.root
    .findAllByType(RNText)
    .map(t =>
      Array.isArray(t.props.children)
        ? t.props.children.join('')
        : String(t.props.children ?? ''),
    );
const byLabel = (label: string) =>
  renderer.root.findAll(
    n => n.props.accessibilityLabel === label && typeof n.type !== 'string',
  )[0];

afterEach(async () => {
  await act(async () => renderer?.unmount());
  headerStore.setBack(null);
  mockRoute = 'Início';
});

it('renders the panel with fixed header, footer and updating bar', async () => {
  const onRefresh = jest.fn();
  await render(
    <ScreenPanel
      refreshing={false}
      onRefresh={onRefresh}
      updating
      header={<Text>Passos</Text>}
      footer={[
        <Button key="a" label="Anterior" />,
        <Button key="b" label="Próximo" />,
      ]}
    >
      <Text>Conteúdo</Text>
    </ScreenPanel>,
  );
  expect(texts()).toEqual(
    expect.arrayContaining(['Passos', 'Conteúdo', 'Anterior', 'Próximo']),
  );
  expect(byLabel('Atualizando dados…')).toBeTruthy();
});

it('shows the period on Início, toggles the menu and opens Sobre from the logo', async () => {
  await render(<Header />);
  expect(texts()).toContain('2026.2');
  await act(async () => byLabel('Abrir menu').props.onPress());
  expect(mockNavigation.toggleDrawer).toHaveBeenCalled();
  await act(async () => byLabel('Sobre o AO UERJ').props.onPress());
  expect(mockNavigation.navigate).toHaveBeenCalledWith('Sobre');
});

it('swaps the menu button for back while a screen registers it', async () => {
  mockRoute = 'Pesquisa de Disciplinas';
  const onBack = jest.fn();
  await render(<Header />);
  expect(texts()).toContain('Pesquisa de Disciplinas');
  await act(async () => headerStore.setBack(onBack));
  await act(async () => byLabel('Voltar').props.onPress());
  expect(onBack).toHaveBeenCalled();
  await act(async () => headerStore.setBack(null));
  expect(byLabel('Abrir menu')).toBeTruthy();
});

it('lists the routes in groups, navigates and signs out from the drawer', async () => {
  const navigation = { navigate: jest.fn(), closeDrawer: jest.fn() };
  const routeNames = [
    'Início',
    'Meu Progresso',
    'Gerador de Grade',
    'Mural de Mensagens',
    'Disciplinas Realizadas',
    'Disciplinas do Currículo',
    'Disciplinas Universais',
    'Pesquisa de Disciplinas',
    'Sobre',
  ];
  await render(
    <CustomDrawerNavigator
      {...({
        state: { routeNames, index: 1 },
        navigation,
      } as any)}
    />,
  );
  const shown = texts();
  expect(shown).toEqual(
    expect.arrayContaining([
      'MT',
      'Marina Albuquerque Teixeira',
      'Matrícula 202310045612',
      'Acadêmico',
      'Ferramentas',
      'Sair',
      expect.stringMatching(/^Versão /),
      ...routeNames,
    ]),
  );
  expect(byLabel('Meu Progresso').props.accessibilityState).toMatchObject({
    selected: true,
  });
  await act(async () => byLabel('Mural de Mensagens').props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith('Mural de Mensagens');
  await act(async () => byLabel('Sair').props.onPress());
  expect(navigation.closeDrawer).toHaveBeenCalled();
  expect(mockSignOut).toHaveBeenCalled();
});

it('wraps long drawer labels and sizes the highlight to the active item', async () => {
  const navigation = { navigate: jest.fn(), closeDrawer: jest.fn() };
  const routeNames = ['Início', 'Disciplinas do Currículo', 'Sobre'];
  await render(
    <CustomDrawerNavigator
      {...({ state: { routeNames, index: 1 }, navigation } as any)}
    />,
  );
  // fonte grande: o rótulo quebra em duas linhas em vez de virar reticências
  const label = renderer.root.findAll(
    n => n.type === RNText && n.props.children === 'Disciplinas do Currículo',
  )[0];
  expect(label.props.numberOfLines).toBe(2);
  await act(async () =>
    byLabel('Disciplinas do Currículo').props.onLayout({
      nativeEvent: { layout: { x: 0, y: 120, width: 276, height: 74 } },
    }),
  );
  const highlight = renderer.root.findAll(n => n.props.$height != null)[0];
  expect(highlight.props.$height).toBe(74);
});

it('registers the header back action only while the screen wants it', async () => {
  const onBack = jest.fn();
  const Screen = ({ detail }: { detail: boolean }) => {
    useHeaderBack(detail ? onBack : null, 'Voltar para a pesquisa');
    return null;
  };
  await render(<Screen detail />);
  expect(headerStore.getSnapshot().backLabel).toBe('Voltar para a pesquisa');
  await act(async () => headerStore.getSnapshot().onBack?.());
  expect(onBack).toHaveBeenCalled();
  await act(async () =>
    renderer.update(
      <ThemeProvider theme={LIGHT}>
        <Screen detail={false} />
      </ThemeProvider>,
    ),
  );
  expect(headerStore.getSnapshot().onBack).toBeNull();
  await act(async () =>
    renderer.update(
      <ThemeProvider theme={LIGHT}>
        <Screen detail />
      </ThemeProvider>,
    ),
  );
  expect(headerStore.getSnapshot().onBack).not.toBeNull();
  await act(async () => renderer.unmount());
  expect(headerStore.getSnapshot().onBack).toBeNull();
});
