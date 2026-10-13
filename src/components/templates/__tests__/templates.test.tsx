import React from 'react';
import type { NavigationState } from '@react-navigation/native';
import {
  act,
  fireEvent,
  renderHook,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import {
  useKeyboardState,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';

import { ThemePreferences } from '@root/modules/appearance/application/ThemePreferences';
import { renderWithProviders } from '@root/test-utils/render';
import { BottomSheet, Button, Text, TextField } from '@components/ui';
import { ScreenPanel } from '../ScreenPanel';
import { Header } from '../Header';
import { headerStore, useHeaderBack } from '../Header/headerStore';
import { DrawerNavigator } from '../CustomDrawerNavigator';

const mockSignOut = jest.fn(() => Promise.resolve());
let mockBottomInset = 0;
const mockNativeAppearance = { apply: jest.fn() };
const mockSavedTheme = new Map<string, unknown>();
let mockAppearance: ThemePreferences;
beforeEach(() => {
  mockSavedTheme.clear();
  mockAppearance = new ThemePreferences({
    store: {
      read: async <T,>(key: string) =>
        (mockSavedTheme.get(key) as T | undefined) ?? null,
      write: async (key, value) => {
        mockSavedTheme.set(key, value);
      },
    },
    native: mockNativeAppearance,
  });
});

jest.mock('@react-navigation/native', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    top: 24,
    bottom: mockBottomInset,
    left: 0,
    right: 0,
  }),
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
  useAppServices: () => ({
    identity: { signOut: mockSignOut },
    appearance: mockAppearance,
  }),
}));
jest.mock('@services/rootNavigation', () => ({
  toggleDrawer: jest.fn(),
  navigate: jest.fn(),
}));
const mockNavigation = jest.requireMock('@services/rootNavigation') as {
  toggleDrawer: jest.Mock;
  navigate: jest.Mock;
};

/** Estado do menu lateral com `route` ativa, como o App repassa ao Header. */
function drawerState(route: string): NavigationState {
  return {
    key: 'drawer',
    index: 0,
    routeNames: [route],
    routes: [{ key: route, name: route }],
    type: 'drawer',
    stale: false,
    preloadedRoutes: [],
  } as NavigationState;
}

afterEach(() => {
  headerStore.setBack(null);
  mockBottomInset = 0;
});

it('renders the panel with fixed header, footer and updating bar', async () => {
  const onRefresh = jest.fn();
  await renderWithProviders(
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
  expect(screen.getByText('Passos')).toBeOnTheScreen();
  expect(screen.getByText('Conteúdo')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Anterior' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Próximo' })).toBeOnTheScreen();
  expect(
    screen.getByRole('progressbar', { name: 'Atualizando dados…' }),
  ).toBeOnTheScreen();
});

describe('ScreenPanel and the keyboard', () => {
  // o mock da lib entrega altura 0; aqui o teclado está aberto com 300 dp
  const animation = jest.mocked(useReanimatedKeyboardAnimation);
  const keyboardState = jest.mocked(useKeyboardState);
  const original = {
    animation: animation.getMockImplementation(),
    keyboardState: keyboardState.getMockImplementation(),
  };
  let visible = true;
  beforeEach(() => {
    mockBottomInset = 24;
    visible = true;
    animation.mockReturnValue({
      height: { value: -300 },
      progress: { value: 1 },
    } as any);
    keyboardState.mockImplementation((selector?: (state: any) => unknown) =>
      selector ? selector({ isVisible: visible }) : { isVisible: visible },
    );
  });
  afterEach(() => {
    animation.mockImplementation(original.animation);
    keyboardState.mockImplementation(original.keyboardState);
  });
  const keyboardArea = () => screen.getByTestId('panel-keyboard-area');

  it('shrinks above the keyboard, leaving the bottom safe area under it', async () => {
    // a janela de ponta a ponta não encolhe: sem isso, o rodapé fixo e o fim
    // da lista ficariam atrás do teclado
    await renderWithProviders(
      <ScreenPanel testID="panel" footer={<Button label="Próximo" />}>
        <Text>Conteúdo</Text>
      </ScreenPanel>,
    );
    expect(keyboardArea()).toHaveStyle({ paddingBottom: 276 });
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeOnTheScreen();
  });

  it('leaves the keyboard of a sheet to the sheet until it closes', async () => {
    // a folha sobe sozinha: se o painel por trás encolhesse junto, ao fechar
    // a folha sobraria um vão em branco enquanto o teclado desce
    const screenWith = (sheet: boolean) => (
      <>
        <ScreenPanel testID="panel">
          <Text>Conteúdo</Text>
        </ScreenPanel>
        {sheet ? (
          <BottomSheet visible title="Reportar problema" onClose={jest.fn()}>
            <TextField accessibilityLabel="Explicação" />
          </BottomSheet>
        ) : null}
      </>
    );
    const { rerender } = await renderWithProviders(screenWith(true));
    expect(keyboardArea()).toHaveStyle({ paddingBottom: 0 });
    // a folha fecha antes de o teclado dela terminar de descer
    await rerender(screenWith(false));
    expect(keyboardArea()).toHaveStyle({ paddingBottom: 0 });
    visible = false;
    await rerender(screenWith(false));
    expect(keyboardArea()).toHaveStyle({ paddingBottom: 276 });
  });
});

it('shows the period on Início, toggles the menu and opens Sobre from the logo', async () => {
  const user = userEvent.setup();
  await renderWithProviders(<Header navigationState={drawerState('Início')} />);
  expect(screen.getByRole('header', { name: '2026.2' })).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Abrir menu' }));
  expect(mockNavigation.toggleDrawer).toHaveBeenCalled();
  await user.press(screen.getByRole('button', { name: 'Sobre o AO UERJ' }));
  expect(mockNavigation.navigate).toHaveBeenCalledWith('Sobre');
});

it('follows the active route after the first render', async () => {
  // Ao restaurar a sessão, a primeira rota é a Carregando e só depois vem o
  // Início: o título (e o próprio cabeçalho) acompanham a troca.
  await renderWithProviders(
    <Header navigationState={drawerState('Loading')} />,
  );
  await screen.rerender(<Header navigationState={drawerState('Início')} />);
  expect(screen.getByRole('header', { name: '2026.2' })).toBeOnTheScreen();
  await screen.rerender(
    <Header navigationState={drawerState('Meu Progresso')} />,
  );
  expect(
    screen.getByRole('header', { name: 'Meu Progresso' }),
  ).toBeOnTheScreen();
});

it('appears once the login gives way to the signed-in routes', async () => {
  await renderWithProviders(<Header navigationState={drawerState('Login')} />);
  expect(
    screen.queryByRole('button', { name: 'Abrir menu' }),
  ).not.toBeOnTheScreen();
  await screen.rerender(<Header navigationState={drawerState('Início')} />);
  expect(screen.getByRole('button', { name: 'Abrir menu' })).toBeOnTheScreen();
});

it('swaps the menu button for back while a screen registers it', async () => {
  const onBack = jest.fn();
  const user = userEvent.setup();
  await renderWithProviders(
    <Header navigationState={drawerState('Pesquisa de Disciplinas')} />,
  );
  expect(
    screen.getByRole('header', { name: 'Pesquisa de Disciplinas' }),
  ).toBeOnTheScreen();
  await act(() => headerStore.setBack(onBack));
  expect(
    screen.queryByRole('button', { name: 'Abrir menu' }),
  ).not.toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Voltar' }));
  expect(onBack).toHaveBeenCalled();
  await act(() => headerStore.setBack(null));
  expect(screen.getByRole('button', { name: 'Abrir menu' })).toBeOnTheScreen();
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
  const user = userEvent.setup();
  await renderWithProviders(
    <DrawerNavigator
      {...({
        state: { routeNames, index: 1 },
        navigation,
      } as any)}
    />,
  );
  // as iniciais do avatar são decorativas: o nome vem logo ao lado
  expect(
    screen.getByText('MT', { includeHiddenElements: true }),
  ).toBeOnTheScreen();
  expect(screen.getByText('Marina Albuquerque Teixeira')).toBeOnTheScreen();
  expect(screen.getByText('Matrícula 202310045612')).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Acadêmico' })).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Ferramentas' })).toBeOnTheScreen();
  for (const route of routeNames) {
    expect(screen.getByRole('menuitem', { name: route })).toHaveTextContent(
      route,
    );
  }
  expect(screen.getByRole('button', { name: 'Sair' })).toHaveTextContent(
    'Sair',
  );
  expect(screen.getByText(/^Versão /)).toBeOnTheScreen();
  expect(
    screen.getByRole('menuitem', { name: 'Meu Progresso' }),
  ).toBeSelected();
  await user.press(
    screen.getByRole('menuitem', { name: 'Mural de Mensagens' }),
  );
  expect(navigation.navigate).toHaveBeenCalledWith('Mural de Mensagens');
  await user.press(screen.getByRole('button', { name: 'Sair' }));
  expect(navigation.closeDrawer).toHaveBeenCalled();
  expect(mockSignOut).toHaveBeenCalled();
});

it('opens the theme options from the drawer footer and applies the choice', async () => {
  const navigation = { navigate: jest.fn(), closeDrawer: jest.fn() };
  const user = userEvent.setup();
  await renderWithProviders(
    <DrawerNavigator
      {...({ state: { routeNames: ['Início'], index: 0 }, navigation } as any)}
    />,
  );
  const button = screen.getByRole('button', {
    name: 'Tema: Padrão do sistema',
  });
  expect(screen.getByHintText('Abre as opções de tema')).toBe(button);
  await user.press(button);
  expect(screen.getByRole('header', { name: 'Tema' })).toBeOnTheScreen();
  expect(
    screen.getByRole('radio', { name: /^Padrão do sistema/ }),
  ).toBeChecked();
  await user.press(screen.getByRole('radio', { name: 'Escuro' }));
  expect(mockNativeAppearance.apply).toHaveBeenCalledWith('dark');
  expect(mockSavedTheme.get('theme-preference')).toBe('dark');
  // escolher fecha a folha; o botão anuncia a nova escolha
  await waitFor(() =>
    expect(
      screen.queryByRole('header', { name: 'Tema' }),
    ).not.toBeOnTheScreen(),
  );
  expect(
    screen.getByRole('button', { name: 'Tema: Escuro' }),
  ).toBeOnTheScreen();
});

it('wraps long drawer labels and sizes the highlight to the active item', async () => {
  const navigation = { navigate: jest.fn(), closeDrawer: jest.fn() };
  const routeNames = ['Início', 'Disciplinas do Currículo', 'Sobre'];
  await renderWithProviders(
    <DrawerNavigator
      {...({ state: { routeNames, index: 1 }, navigation } as any)}
    />,
  );
  // fonte grande: o rótulo quebra em duas linhas em vez de virar reticências
  expect(screen.getByText('Disciplinas do Currículo')).toHaveProp(
    'numberOfLines',
    2,
  );
  await fireEvent.layout(
    screen.getByRole('menuitem', { name: 'Disciplinas do Currículo' }),
    { x: 0, y: 120, width: 276, height: 74 },
  );
  // o destaque é decorativo: o item ativo já é anunciado como selecionado
  expect(screen.getByTestId('drawer-highlight')).toHaveStyle({ height: 74 });
});

it('registers the header back action only while the screen wants it', async () => {
  const onBack = jest.fn();
  const { rerender, unmount } = await renderHook(
    ({ detail }: { detail: boolean }) =>
      useHeaderBack(detail ? onBack : null, 'Voltar para a pesquisa'),
    { initialProps: { detail: true } },
  );
  expect(headerStore.getSnapshot().backLabel).toBe('Voltar para a pesquisa');
  headerStore.getSnapshot().onBack?.();
  expect(onBack).toHaveBeenCalled();
  await rerender({ detail: false });
  expect(headerStore.getSnapshot().onBack).toBeNull();
  await rerender({ detail: true });
  expect(headerStore.getSnapshot().onBack).not.toBeNull();
  await unmount();
  expect(headerStore.getSnapshot().onBack).toBeNull();
});
