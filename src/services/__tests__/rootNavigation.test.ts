import type { NavigationContainerRef } from '@react-navigation/native';
import type { RootDrawerParamList } from '@root/routes';
import {
  getCurrentRouteName,
  isNavigationReady,
  navigate,
  navigationRef,
  toggleDrawer,
} from '../rootNavigation';

jest.mock('@react-navigation/native', () => ({
  DrawerActions: { toggleDrawer: () => ({ type: 'TOGGLE_DRAWER' }) },
}));

const makeNavigation = (ready = true) => ({
  isReady: jest.fn(() => ready),
  navigate: jest.fn(),
  dispatch: jest.fn(),
  getCurrentRoute: jest.fn(() => ({ key: 'home', name: 'Início' })),
});
const attach = (navigation: ReturnType<typeof makeNavigation> | null) => {
  navigationRef.current =
    navigation as unknown as NavigationContainerRef<RootDrawerParamList> | null;
};

afterEach(() => attach(null));

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

it('ignores actions before readiness or while the navigator is unmounted', () => {
  const navigation = makeNavigation(false);
  attach(navigation);
  toggleDrawer();
  navigate('Sobre');
  expect(isNavigationReady()).toBe(false);
  expect(getCurrentRouteName()).toBeUndefined();
  expect(navigation.dispatch).not.toHaveBeenCalled();
  expect(navigation.navigate).not.toHaveBeenCalled();
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
