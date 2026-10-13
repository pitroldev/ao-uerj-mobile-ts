import { useColorScheme } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { DARK, LIGHT } from '@root/themes';
import {
  THEME_PREFERENCE_KEY,
  ThemePreferences,
} from '../../application/ThemePreferences';
import { navigationTheme } from '../navigationTheme';
import { useActiveTheme } from '../useActiveTheme';

// o pacote é ESM e os testes o simulam: só a base de cada tema importa aqui
jest.mock('@react-navigation/native', () => {
  const base = (dark: boolean) => ({
    dark,
    colors: {
      primary: 'primary',
      background: 'background',
      card: 'card',
      text: 'text',
      border: 'border',
      notification: 'notification',
    },
    fonts: {},
  });
  return { DefaultTheme: base(false), DarkTheme: base(true) };
});

// o preset do RN simula o hook (sempre "light"); aqui ele faz o aparelho
const deviceScheme = jest.mocked(useColorScheme);

afterEach(() => {
  deviceScheme.mockReturnValue('light');
});

function createAppearance(saved?: string) {
  const native = { apply: jest.fn() };
  const appearance = new ThemePreferences({
    store: {
      read: async <T,>(key: string) =>
        key === THEME_PREFERENCE_KEY && saved ? (saved as T) : null,
      write: async () => undefined,
    },
    native,
  });
  return { appearance, native };
}

it('follows the device while the choice is the system default', async () => {
  deviceScheme.mockReturnValue('dark');
  const { appearance } = createAppearance();
  const { result, rerender } = await renderHook(() =>
    useActiveTheme(appearance),
  );
  expect(result.current).toBe(DARK);
  // o aparelho trocou de modo com o app aberto
  deviceScheme.mockReturnValue('light');
  await rerender({});
  expect(result.current).toBe(LIGHT);
});

it('restores the saved choice and keeps it whatever the device says', async () => {
  const { appearance, native } = createAppearance('dark');
  const { result, rerender } = await renderHook(() =>
    useActiveTheme(appearance),
  );
  await waitFor(() => expect(result.current).toBe(DARK));
  expect(native.apply).toHaveBeenCalledWith('dark');

  await act(() => appearance.choose('light'));
  expect(result.current).toBe(LIGHT);
  deviceScheme.mockReturnValue('dark');
  await rerender({});
  expect(result.current).toBe(LIGHT);
});

it('gives React Navigation the same scheme, with the blue behind the screens', () => {
  expect(navigationTheme(DARK)).toMatchObject({
    dark: true,
    colors: {
      background: DARK.colors.brand,
      card: DARK.colors.surface,
      text: DARK.colors.ink,
    },
  });
  expect(navigationTheme(LIGHT)).toMatchObject({
    dark: false,
    colors: { background: LIGHT.colors.brand, text: LIGHT.colors.ink },
  });
  // mesmo objeto a cada render: o NavigationContainer não refaz o tema
  expect(navigationTheme(DARK)).toBe(navigationTheme(DARK));
});
