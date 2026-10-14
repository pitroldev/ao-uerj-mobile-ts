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
  StatusToneColors,
  ThemeColors,
  ToneColors,
} from './types';

const tone = (
  ink: string,
  bg: string,
  line: string,
  wash = bg,
  washLine = line,
): StatusToneColors => ({ ink, bg, line, wash, washLine });

/**
 * Tema escuro com cabeçalho, menu e moldura em marinho profundo. As
 * superfícies seguem o matiz da UERJ, com elevação por degraus
 * (painel < elevada < mais alta) em vez de sombras. O acento claro fica para
 * texto, ícones, indicadores e fios; o preenchimento (`fill`) é um azul médio
 * com texto branco.
 *
 * Contraste (WCAG), conferido: `ink` de 15,4:1 (fundo) a 10,6:1 (degrau mais
 * alto da folha); `inkMuted` de 8,6:1 a 5,9:1 nos mesmos extremos; `accent` 7,7:1 (fundo), 6,2:1 (superfície da folha) e 5,4:1 sobre
 * `accentSoft`; branco sobre `fill` 5,3:1 (4,7:1 pressionado); tintas de
 * status e turno de 5,4:1 a 9,0:1 sobre os próprios fundos; `fieldBorder`
 * 3,1:1 ou mais contra as superfícies onde há campos.
 */
const colors: ThemeColors = {
  brand: '#071425',
  brandHighlight: '#173A60',
  onBrand: '#E6EDF6',
  onBrandSelected: '#CFE6FF',
  onBrandMuted: '#A7B4C6',
  brandRule: '#2C4058',
  onBrandPressed: 'rgba(230,237,246,0.12)',
  onBrandTrack: '#2C4058',
  onBrandRing: '#2C4058',

  background: '#0B1626',
  surface: '#111F33',
  surfaceMuted: '#111F33',
  surfacePressed: '#182A43',
  surfaceStrong: '#182A43',
  sheet: '#111F33',
  float: '#182A43',

  rule: '#304259',
  ruleStrong: '#3B4E68',
  fieldBorder: '#63768F',
  /** ".busy{--rule}": a malha de 7×17 fios desce um degrau (1,5:1). */
  gridRule: '#26374D',

  ink: '#E6EDF6',
  inkMuted: '#A7B4C6',
  inkSubtle: '#7E8DA3',

  accent: '#6DAEF0',
  fill: '#2A6BC0',
  fillPressed: '#3273C9',
  onFill: '#FFFFFF',
  accentSoft: '#123458',
  accentLine: '#2D5786',
  selection: '#17497B',
  noticeWarnAction: '#F8D48B',
  noticeBadAction: '#FF9C92',

  logo: '#E6EDF6',
  scrim: 'rgba(2,8,20,0.62)',
  /** Não definido no protótipo: a tinta a 12%, o mesmo papel do claro. */
  pressedOverlay: 'rgba(230,237,246,0.12)',

  snackbar: '#273E5C',
  onSnackbar: '#EEF3F9',
  snackbarSuccess: '#A4EBB8',
  snackbarError: '#FF9C92',

  shadow: '#000612',
};

/** ".sheet" do escuro: a folha já é a superfície elevada, então tudo sobe um nível. */
const sheetColors: Partial<ThemeColors> = {
  background: '#111F33',
  surface: '#182A43',
  surfaceMuted: '#182A43',
  surfacePressed: '#1F3551',
  surfaceStrong: '#1F3551',
  rule: '#33475F',
  ruleStrong: '#42566F',
};

/**
 * Status viram superfícies tingidas com texto claro do mesmo matiz. Em áreas
 * grandes (avisos, células marcadas), atenção e crítico usam um degrau mais
 * calmo (`wash`).
 */
const status: Record<StatusTone, StatusToneColors> = {
  good: tone('#A4EBB8', '#1E4A2E', '#3B6A4A'),
  warn: tone('#F8D48B', '#573900', '#78571D', '#462D00', '#6A4C1D'),
  bad: tone('#FF9C92', '#612E2B', '#854B47', '#4C221F', '#743E3B'),
  neutral: tone('#B3BFCF', '#36414F', '#535F6E'),
  info: tone(colors.accent, colors.accentSoft, colors.accentLine),
};

const shift: Record<ShiftTone, ToneColors> = {
  morning: { ink: '#F2D98C', bg: '#4E3A03', line: '#715A24' },
  afternoon: { ink: '#FFCC9C', bg: '#593014', line: '#7F4F31' },
  night: { ink: '#99E6FF', bg: '#184655', line: '#356575' },
};

export const darkTheme: AppTheme = {
  name: 'dark',
  colors,
  sheetColors,
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
      shadowOpacity: 0.5,
      shadowRadius: 16,
      shadowOffset: { width: -12, height: 0 },
      elevation: 16,
    },
    sheet: {
      shadowColor: '#00040C',
      shadowOpacity: 0.5,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: -10 },
      elevation: 24,
    },
    snackbar: {
      shadowColor: '#00040C',
      shadowOpacity: 0.5,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
  },
};
