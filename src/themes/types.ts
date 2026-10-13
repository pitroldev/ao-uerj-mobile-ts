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

/** Tom de status: o trio de sempre e o fundo das áreas grandes. */
export type StatusToneColors = ToneColors & {
  /**
   * Fundo de área grande (aviso, célula marcada). No claro é o próprio `bg`;
   * no escuro, atenção e crítico descem um degrau para não gritar.
   */
  wash: string;
  /** Fio sobre `wash`. */
  washLine: string;
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

  /**
   * Fundo do painel de conteúdo (e do Login). No claro é igual a `surface`;
   * no escuro fica um degrau abaixo das superfícies elevadas.
   */
  background: string;
  /**
   * Superfície elevada sobre o painel: card, campo, chip, seletor, botão
   * contornado, controle segmentado.
   */
  surface: string;
  /** Fundo levemente destacado: linha pressionada, aviso neutro, evento, balão. */
  surfaceMuted: string;
  /** Toque sobre uma superfície elevada (card, chip, dia, segmento). */
  surfacePressed: string;
  /** Fundo mais forte: trilho de progresso, esqueleto, botão desabilitado. */
  surfaceStrong: string;
  /** Fundo da folha inferior. */
  sheet: string;
  /** Etiqueta que flutua sobre o conteúdo (data grudada da conversa). */
  float: string;

  /** Fio padrão de 1px (divisores, cards). */
  rule: string;
  /** Fio forte (chips, controle segmentado, contornos). */
  ruleStrong: string;
  /** Borda de campo de texto e seletor. */
  fieldBorder: string;
  /**
   * Fios internos de malhas densas (horários ocupados do gerador). No escuro
   * descem um degrau abaixo de `rule`; a borda da malha continua `ruleStrong`.
   */
  gridRule: string;

  /** Texto principal. */
  ink: string;
  /** Texto secundário (metadados, legendas): 5,8:1 sobre branco, 8,6:1 sobre o fundo escuro. */
  inkMuted: string;
  /** Terciário: só decorativo (pontos, linha média do gráfico): 3,7:1, não use em texto. */
  inkSubtle: string;

  /**
   * Acento: só em seleção e ações, como texto, ícone, indicador e fio. Para
   * fundo com texto por cima, use `fill`.
   */
  accent: string;
  /**
   * Preenchimento de ação e seleção forte: botão primário, enviar do mural,
   * dia escolhido, caixa marcada, interruptor ligado, passo atual. No claro é
   * o próprio acento; no escuro, um azul médio que segura texto branco.
   */
  fill: string;
  /** `fill` pressionado. */
  fillPressed: string;
  /** Texto e ícones sobre `fill`. */
  onFill: string;
  /** Fundo suave do acento (chip/linha selecionados, aviso informativo). */
  accentSoft: string;
  /** Fio sobre o fundo suave do acento. */
  accentLine: string;
  /** Seleção de texto. */
  selection: string;
  /**
   * Ação em texto dos avisos de atenção e crítico. No claro é o acento; no
   * escuro segue o tom do aviso (e o `Notice` a sublinha para seguir lida
   * como link).
   */
  noticeWarnAction: string;
  noticeBadAction: string;

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

type ShadowStyle = {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
};

export type ColorSchemeName = 'light' | 'dark';

export type AppTheme = {
  name: ColorSchemeName;
  colors: ThemeColors;
  /**
   * Cores trocadas dentro da folha inferior, que já é uma superfície
   * elevada: cada degrau sobe um nível (vazio no claro, onde tudo é branco).
   */
  sheetColors: Partial<ThemeColors>;
  status: Record<StatusTone, StatusToneColors>;
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
