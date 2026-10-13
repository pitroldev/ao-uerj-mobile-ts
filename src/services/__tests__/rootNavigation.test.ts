import type { NavigationContainerRef } from '@react-navigation/native';
import type { RootDrawerParamList } from '@root/routes';
import {
  getCurrentRouteName,
  isNavigationReady,
  navigate,
  registerNavigationContainer,
  toggleDrawer,
} from '../rootNavigation';

jest.mock('@react-navigation/native', () => ({
  DrawerActions: { toggleDrawer: () => ({ type: 'TOGGLE_DRAWER' }) },
}));
jest.mock('react-native', () => ({ Keyboard: { dismiss: jest.fn() } }));
const { Keyboard } = jest.requireMock('react-native') as {
  Keyboard: { dismiss: jest.Mock };
};

const makeNavigation = (ready = true) => ({
  isReady: jest.fn(() => ready),
  navigate: jest.fn(),
  dispatch: jest.fn(),
  getCurrentRoute: jest.fn(() => ({ key: 'home', name: 'Início' })),
});
type Navigation = ReturnType<typeof makeNavigation>;
/** Raiz do app com este container (`null`: nenhuma montada). */
const root = (navigation: Navigation | null) => ({
  current:
    navigation as unknown as NavigationContainerRef<RootDrawerParamList> | null,
});
let detach: (() => void) | undefined;
const attach = (navigation: Navigation | null) => {
  detach?.();
  detach = navigation
    ? registerNavigationContainer(root(navigation))
    : undefined;
};
/** Raízes que convivem; o `afterEach` retira as que um teste com falha deixou. */
const mounted: (() => void)[] = [];
const register = (navigation: Navigation) => {
  const unregister = registerNavigationContainer(root(navigation));
  mounted.push(unregister);
  return unregister;
};

afterEach(() => {
  attach(null);
  mounted.splice(0).forEach(unregister => unregister());
});

it('uses the mounted navigator readiness without a separate onReady flag', () => {
  const navigation = makeNavigation();
  attach(navigation);
  expect(isNavigationReady()).toBe(true);
  toggleDrawer();
  navigate('Sobre');
  expect(navigation.dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_DRAWER' });
  expect(navigation.navigate).toHaveBeenCalledWith('Sobre', undefined);
  expect(getCurrentRouteName()).toBe('Início');
});

it('hides the keyboard of a search before the menu opens over it', () => {
  const navigation = makeNavigation();
  attach(navigation);
  toggleDrawer();
  expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
  expect(Keyboard.dismiss.mock.invocationCallOrder[0]).toBeLessThan(
    navigation.dispatch.mock.invocationCallOrder[0],
  );
});

it('ignores actions before readiness or while the navigator is unmounted', () => {
  const navigation = makeNavigation(false);
  attach(navigation);
  toggleDrawer();
  navigate('Sobre');
  expect(isNavigationReady()).toBe(false);
  expect(getCurrentRouteName()).toBeUndefined();
  expect(navigation.dispatch).not.toHaveBeenCalled();
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(Keyboard.dismiss).not.toHaveBeenCalled();
  attach(null);
  expect(isNavigationReady()).toBe(false);
  expect(() => {
    toggleDrawer();
    navigate('Sobre');
  }).not.toThrow();
});

it('resumes actions when a navigator becomes ready or is replaced after recovery', () => {
  const first = makeNavigation(false);
  attach(first);
  expect(isNavigationReady()).toBe(false);
  first.isReady.mockReturnValue(true);
  toggleDrawer();
  expect(first.dispatch).toHaveBeenCalledTimes(1);
  attach(null);
  const recovered = makeNavigation();
  attach(recovered);
  toggleDrawer();
  expect(recovered.dispatch).toHaveBeenCalledTimes(1);
});

it('keeps the newest root when an activity recreation overlaps the old one', () => {
  // a raiz nova monta antes de a antiga desmontar
  const old = makeNavigation();
  const unregisterOld = register(old);
  old.getCurrentRoute.mockReturnValue({ key: 'grades', name: 'Notas' });
  const recreated = makeNavigation();
  const unregisterRecreated = register(recreated);

  // com as duas montadas, as ações vão para a nova, a que está na tela
  toggleDrawer();
  navigate('Sobre');
  expect(recreated.dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_DRAWER' });
  expect(recreated.navigate).toHaveBeenCalledWith('Sobre', undefined);
  expect(getCurrentRouteName()).toBe('Início');
  expect(old.dispatch).not.toHaveBeenCalled();
  expect(old.navigate).not.toHaveBeenCalled();

  // a saída da antiga não desliga o menu nem o logo do cabeçalho
  unregisterOld();
  toggleDrawer();
  expect(recreated.dispatch).toHaveBeenCalledTimes(2);
  expect(old.dispatch).not.toHaveBeenCalled();
  unregisterRecreated();
  expect(isNavigationReady()).toBe(false);
});

it('falls back to the older root when the newer one leaves first', () => {
  const old = makeNavigation();
  const unregisterOld = register(old);
  const newer = makeNavigation();
  const unregisterNewer = register(newer);
  unregisterNewer();
  toggleDrawer();
  navigate('Sobre');
  expect(newer.dispatch).not.toHaveBeenCalled();
  expect(newer.navigate).not.toHaveBeenCalled();
  expect(old.dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_DRAWER' });
  expect(old.navigate).toHaveBeenCalledWith('Sobre', undefined);
  unregisterOld();
  expect(isNavigationReady()).toBe(false);
});
