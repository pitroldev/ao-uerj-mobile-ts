import { lightTheme } from './light';

export * from './tokens';
export type {
  AppTheme,
  ShadowStyle,
  ShiftTone,
  StatusTone,
  ThemeColors,
  ToneColors,
} from './types';
export { lightTheme };

/**
 * Tema ativo do app, entregue pelo `ThemeProvider` (só o claro por enquanto).
 * Fora de componentes (estilos de navegação, `ErrorBoundary`), use
 * `LIGHT.colors`, `LIGHT.layout` etc.
 */
export const LIGHT = lightTheme;
