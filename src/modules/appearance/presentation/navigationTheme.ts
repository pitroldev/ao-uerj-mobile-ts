import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

import type { AppTheme } from '@root/themes';

const cache = new WeakMap<AppTheme, Theme>();

/**
 * Tema do React Navigation coerente com o do app (mesmo objeto por tema). O
 * fundo das telas é o azul, por trás do painel arredondado; as outras cores
 * só valem para peças padrão do navegador.
 */
export function navigationTheme(theme: AppTheme): Theme {
  let navigation = cache.get(theme);
  if (!navigation) {
    const base = theme.name === 'dark' ? DarkTheme : DefaultTheme;
    navigation = {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.colors.accent,
        background: theme.colors.brand,
        card: theme.colors.surface,
        text: theme.colors.ink,
        border: theme.colors.rule,
        notification: theme.status.bad.ink,
      },
    };
    cache.set(theme, navigation);
  }
  return navigation;
}
