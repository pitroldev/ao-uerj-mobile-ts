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
 * Tema escuro "Abissal & Ardósia": cabeçalho, menu e moldura recuam para um
 * marinho abissal quase preto (`#050A12`), fazendo o painel de conteúdo em
 * ardósia fria (`#101722`) saltar à frente na curva de 48dp. As superfícies
 * sobem por degraus nítidos e pouco saturados (`surfaceMuted` < `surface` <
 * `surfaceStrong`), com fios discretos para evitar aspecto gradeado.
 *
 * Contraste (WCAG), conferido: `ink` de 16,0:1 (fundo) a 10,0:1 (degrau mais
 * alto da folha); `inkMuted` de 8,1:1 a 5,1:1 nos mesmos extremos; `accent`
 * 8,6:1 (fundo), 6,5:1 (superfície da folha) e 6,3:1 sobre `accentSoft`;
 * branco sobre `fill` 5,6:1 (4,9:1 pressionado); tintas de status e turno de
 * 5,6:1 a 9,8:1 sobre os próprios fundos; `fieldBorder` 3,2:1 ou mais contra
 * as superfícies onde há campos.
 */
const colors: ThemeColors = {
  brand: '#050A12',
  brandHighlight: '#132B4A',
  onBrand: '#ECF2F9',
  onBrandSelected: '#FFFFFF',
  onBrandMuted: '#9FB1C8',
  brandRule: '#1A293D',
  onBrandPressed: 'rgba(236,242,249,0.12)',
  onBrandTrack: '#1A293D',
  onBrandRing: '#223650',

  background: '#101722',
  surface: '#182231',
  surfaceMuted: '#141C29',
  surfacePressed: '#202D40',
  surfaceStrong: '#243247',
  sheet: '#192332',
  float: '#202D40',

  rule: '#253246',
  ruleStrong: '#31425B',
  fieldBorder: '#6D7C94',
  /** ".busy{--rule}": a malha de 7×17 fios desce um degrau. */
  gridRule: '#1C2636',

  ink: '#ECF2FA',
  inkMuted: '#9EB0C7',
  inkSubtle: '#73859E',

  accent: '#76B7FF',
  fill: '#2366C2',
  fillPressed: '#2B70CF',
  onFill: '#FFFFFF',
  accentSoft: '#143056',
  accentLine: '#29558C',
  selection: '#1A4375',
  noticeWarnAction: '#F7D383',
  noticeBadAction: '#FFA096',

  logo: '#ECF2FA',
  scrim: 'rgba(2,5,11,0.72)',
  pressedOverlay: 'rgba(236,242,250,0.11)',

  snackbar: '#243247',
  onSnackbar: '#F0F4FA',
  snackbarSuccess: '#94EAB0',
  snackbarError: '#FFA096',

  shadow: '#00040B',
};

/** ".sheet" do escuro: a folha já é a superfície elevada, então tudo sobe um nível. */
const sheetColors: Partial<ThemeColors> = {
  background: '#192332',
  surface: '#212E42',
  surfaceMuted: '#1C2839',
  surfacePressed: '#293952',
  surfaceStrong: '#2B3B54',
  rule: '#30415A',
  ruleStrong: '#3D5270',
};

/**
 * Status viram superfícies tingidas profundas com texto claro do mesmo matiz.
 * Em áreas grandes (avisos, células marcadas), cada tom usa um degrau mais
 * calmo (`wash`).
 */
const status: Record<StatusTone, StatusToneColors> = {
  good: tone('#94EAB0', '#143826', '#285E42', '#112E20', '#214F37'),
  warn: tone('#F7D383', '#3D2B08', '#6B4E17', '#312206', '#594012'),
  bad: tone('#FFA096', '#451D20', '#75353A', '#371619', '#612B2F'),
  neutral: tone('#BAC7D8', '#253245', '#3B4C63', '#1E2939', '#324156'),
  info: tone(colors.accent, colors.accentSoft, colors.accentLine),
};

const shift: Record<ShiftTone, ToneColors> = {
  morning: { ink: '#F4DA88', bg: '#3A2C08', line: '#634D18' },
  afternoon: { ink: '#FFC899', bg: '#422510', line: '#6E4122' },
  night: { ink: '#91E3FF', bg: '#123647', line: '#265B73' },
};

export const darkTheme: AppTheme = {
  name: 'dark',
  colors,
  campusMap: {
    land: '#1D2925',
    building: '#2A3A4D',
    outline: '#768BA1',
    street: '#233042',
    streetEdge: '#3C4D63',
    ground: '#141C29',
    water: '#1D4159',
  },
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
