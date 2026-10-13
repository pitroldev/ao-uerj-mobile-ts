import { useEffect, useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';

import { themes, type AppTheme } from '@root/themes';
import type { ThemePreferences } from '../application/ThemePreferences';
import {
  resolveColorScheme,
  type ThemePreference,
} from '../domain/themePreference';

/** A escolha atual, atualizada a cada troca. */
export function usePreferenceOf(appearance: ThemePreferences): ThemePreference {
  return useSyncExternalStore(
    appearance.subscribe,
    appearance.getSnapshot,
    appearance.getSnapshot,
  );
}

/**
 * Tema em uso: o escolhido ou, em "Padrão do sistema", o do aparelho
 * (acompanha a troca com o app aberto). Lê a escolha salva na abertura.
 * Recebe o serviço porque o `App` fica acima do `AppServicesProvider`.
 */
export function useActiveTheme(appearance: ThemePreferences): AppTheme {
  const preference = usePreferenceOf(appearance);
  const system = useColorScheme();
  useEffect(() => {
    void appearance.start();
  }, [appearance]);
  return themes[resolveColorScheme(preference, system)];
}
