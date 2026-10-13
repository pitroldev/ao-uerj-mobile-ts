import { darkTheme } from './dark';
import { lightTheme } from './light';
import type { AppTheme, ColorSchemeName } from './types';

export * from './tokens';
export type { AppTheme, ColorSchemeName } from './types';

/**
 * Os dois temas por esquema de cor. Componentes leem o tema ativo com
 * `useTheme()`; quem fica fora do `ThemeProvider` (o `ErrorBoundary`) escolhe
 * aqui pelo `useColorScheme()`, que acompanha a escolha do usuário porque o
 * app a repassa ao `Appearance`.
 */
export const themes: Record<ColorSchemeName, AppTheme> = {
  light: lightTheme,
  dark: darkTheme,
};

/** Tema claro: testes e a imagem compartilhada da grade, que é sempre clara. */
export const LIGHT = lightTheme;
/** Tema escuro, para testes e comparações. */
export const DARK = darkTheme;

const sheetThemes = new WeakMap<AppTheme, AppTheme>();

/**
 * Tema do conteúdo da folha inferior: as cores de `sheetColors` por cima das
 * do tema (no claro, o próprio tema). Mesmo objeto a cada chamada, para não
 * refazer os estilos de quem está dentro.
 */
export function sheetTheme(theme: AppTheme): AppTheme {
  if (Object.keys(theme.sheetColors).length === 0) return theme;
  let elevated = sheetThemes.get(theme);
  if (!elevated) {
    elevated = { ...theme, colors: { ...theme.colors, ...theme.sheetColors } };
    sheetThemes.set(theme, elevated);
  }
  return elevated;
}
