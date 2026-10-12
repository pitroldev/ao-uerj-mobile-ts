import {
  borders,
  fontFamilies,
  layout,
  motion,
  radii,
  sizes,
  spacing,
  typeScale,
} from './tokens';
import type {
  AppTheme,
  ShiftTone,
  StatusTone,
  ThemeColors,
  ToneColors,
} from './types';

/** Cores do tema claro (":root" do protótipo V3). */
export const colors: ThemeColors = {
  brand: '#003468',
  brandHighlight: '#004891',
  onBrand: '#FFFFFF',
  onBrandMuted: 'rgba(255,255,255,0.76)',
  brandRule: 'rgba(255,255,255,0.14)',
  onBrandPressed: 'rgba(255,255,255,0.16)',
  onBrandTrack: 'rgba(255,255,255,0.18)',
  onBrandRing: 'rgba(255,255,255,0.2)',

  surface: '#FFFFFF',
  surfaceMuted: '#F6F7F9',
  surfaceStrong: '#EDF0F4',
  sheet: '#FFFFFF',

  rule: '#E4E7EC',
  ruleStrong: '#D0D5DD',
  fieldBorder: '#B8BFCA',

  ink: '#101828',
  inkMuted: '#5D6679',
  inkSubtle: '#7C8596',

  accent: '#004891',
  /** Acento 88% + tinta 12%. */
  accentPressed: '#02427F',
  onAccent: '#FFFFFF',
  accentSoft: '#E8F0FA',
  accentLine: '#BBD0EC',
  selection: '#CFE0F5',

  logo: '#003468',
  scrim: 'rgba(10,20,40,0.44)',
  pressedOverlay: 'rgba(16,24,40,0.10)',

  snackbar: '#1C2433',
  onSnackbar: '#F2F4F7',
  snackbarSuccess: '#8FD9A8',
  snackbarError: '#F7A39B',

  shadow: '#000C20',
};

/** Significados: saúde da nota/vagas, situação da disciplina, avisos. */
export const status: Record<StatusTone, ToneColors> = {
  good: { ink: '#17673A', bg: '#DDF5E3', line: '#A9DDB7' },
  warn: { ink: '#715600', bg: '#FAF4CC', line: '#E5D682' },
  bad: { ink: '#A4261E', bg: '#FCE4E2', line: '#F1B5AF' },
  neutral: { ink: '#4A5263', bg: '#EDEFF3', line: '#D3D8E0' },
  info: { ink: colors.accent, bg: colors.accentSoft, line: colors.accentLine },
};

/** Turnos: Manhã (amarelo), Tarde (pêssego), Noite (azul-claro). */
export const shift: Record<ShiftTone, ToneColors> = {
  morning: { ink: '#665400', bg: '#FBF8D6', line: '#E6DC98' },
  afternoon: { ink: '#894A0F', bg: '#FFEEDB', line: '#F0CBA4' },
  night: { ink: '#0A5A73', bg: '#DEF3FA', line: '#A6D8E9' },
};

export const lightTheme: AppTheme = {
  name: 'light',
  colors,
  status,
  shift,
  fonts: fontFamilies,
  typography: typeScale,
  spacing,
  layout,
  radii,
  borders,
  sizes,
  motion,
  shadows: {
    panel: {
      shadowColor: colors.shadow,
      shadowOpacity: 0.3,
      shadowRadius: 16,
      shadowOffset: { width: -12, height: 0 },
      elevation: 16,
    },
    sheet: {
      shadowColor: '#101828',
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: -10 },
      elevation: 24,
    },
    snackbar: {
      shadowColor: '#000000',
      shadowOpacity: 0.24,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
  },
};
