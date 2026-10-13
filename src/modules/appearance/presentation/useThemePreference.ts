import { useAppServices } from '@root/app/providers/AppServicesProvider';
import type { ThemePreference } from '../domain/themePreference';
import { usePreferenceOf } from './useActiveTheme';

/** A escolha de tema do usuário e como trocá-la. */
export function useThemePreference(): {
  preference: ThemePreference;
  choose: (preference: ThemePreference) => Promise<void>;
} {
  const { appearance } = useAppServices();
  return { preference: usePreferenceOf(appearance), choose: appearance.choose };
}
