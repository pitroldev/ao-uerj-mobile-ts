import type {
  borders,
  fontFamilies,
  layout,
  motion,
  radii,
  sizes,
  spacing,
  typeScale,
} from './tokens';

/** Trio de cores de um significado: texto/ícone, fundo pastel e fio. */
export type ToneColors = {
  /** Texto, ícone e ponto de status (contraste ≥ 4.5:1 sobre `bg` e `surface`). */
  ink: string;
  /** Fundo pastel pequeno (célula de nota, tag, aviso). */
  bg: string;
  /** Fio/borda sobre o fundo pastel. */
  line: string;
};

export type StatusTone = 'good' | 'warn' | 'bad' | 'neutral' | 'info';
export type ShiftTone = 'morning' | 'afternoon' | 'night';

export type ThemeColors = {
  /** Azul UERJ: barra de status, cabeçalho e menu lateral. */
  brand: string;
  /** Azul de destaque sobre o `brand` (item ativo do menu, avatar). */
  brandHighlight: string;
  /** Texto e ícones sobre o `brand`. */
  onBrand: string;
  /** Texto secundário sobre o `brand`. */
  onBrandMuted: string;
  /** Fios sobre o `brand`. */
  brandRule: string;
  /** Véu de toque sobre o `brand` (botões do cabeçalho e do menu). */
  onBrandPressed: string;
  /** Trilho da barra de carregamento sobre o `brand`. */
  onBrandTrack: string;
  /** Contorno do avatar sobre o `brand`. */
  onBrandRing: string;

  /** Fundo do painel de conteúdo e dos cards. */
  surface: string;
  /** Fundo levemente destacado: linha pressionada, aviso neutro, evento. */
  surfaceMuted: string;
  /** Fundo mais forte: trilho de progresso, esqueleto, botão desabilitado. */
  surfaceStrong: string;
  /** Fundo da folha inferior. */
  sheet: string;

  /** Fio padrão de 1px (divisores, cards). */
  rule: string;
  /** Fio forte (chips, controle segmentado, contornos). */
  ruleStrong: string;
  /** Borda de campo de texto e seletor. */
  fieldBorder: string;

  /** Texto principal. */
  ink: string;
  /** Texto secundário (metadados, legendas). Contraste 5,8:1 sobre branco. */
  inkMuted: string;
  /** Terciário: só decorativo (pontos, linha média do gráfico): 3,7:1, não use em texto. */
  inkSubtle: string;

  /** Acento: só em seleção e ações. */
  accent: string;
  /** Acento pressionado (botão primário, enviar do mural). */
  accentPressed: string;
  onAccent: string;
  /** Fundo suave do acento (chip/linha selecionados, aviso informativo). */
  accentSoft: string;
  /** Fio sobre o fundo suave do acento. */
  accentLine: string;
  /** Seleção de texto. */
  selection: string;

  /** Cor do logo AO sobre superfícies claras. */
  logo: string;
  /** Véu atrás de folhas e diálogos. */
  scrim: string;
  /** Véu de toque dos botões de ícone sobre a superfície. */
  pressedOverlay: string;

  /** Snackbar escuro. */
  snackbar: string;
  onSnackbar: string;
  snackbarSuccess: string;
  snackbarError: string;

  /** Cor base de sombras. */
  shadow: string;
};

export type ShadowStyle = {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
};

export type AppTheme = {
  name: 'light';
  colors: ThemeColors;
  status: Record<StatusTone, ToneColors>;
  shift: Record<ShiftTone, ToneColors>;
  fonts: typeof fontFamilies;
  typography: typeof typeScale;
  spacing: typeof spacing;
  layout: typeof layout;
  radii: typeof radii;
  borders: typeof borders;
  sizes: typeof sizes;
  motion: typeof motion;
  shadows: {
    /** Painel deslizando sobre o menu lateral. */
    panel: ShadowStyle;
    /** Folha inferior. */
    sheet: ShadowStyle;
    /** Snackbar. */
    snackbar: ShadowStyle;
  };
};
