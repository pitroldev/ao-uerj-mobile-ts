/**
 * Tokens do design system "Agenda limpa" (variante 3).
 *
 * Os valores de cor vêm do bloco `:root` (tema claro) do protótipo de
 * referência; tipografia, espaçamentos, raios e alturas vêm do CSS dele.
 * As escalas aqui são independentes de tema; as cores ficam em `light.ts` e
 * `dark.ts`, com os mesmos nomes semânticos.
 */

/* ------------------------------------------------------------- tipografia */

/**
 * Famílias estáticas do Inter. No Android o peso é escolhido pela família
 * (nome do arquivo em android/app/src/main/assets/fonts); nunca combine estas
 * famílias com `fontWeight`, ou o Android sintetiza um negrito falso.
 * No iOS o nome é o PostScript name do arquivo, que é igual.
 */
export const fontFamilies = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
  /** Corte "Display" (tamanho óptico 32) para títulos de 22px ou mais. */
  displaySemibold: 'InterDisplay-SemiBold',
} as const;

export type FontWeightName = 'regular' | 'medium' | 'semibold' | 'bold';

export type TypeVariantName =
  | 'display'
  | 'titleXL'
  | 'titleL'
  | 'titleM'
  | 'titleS'
  | 'headline'
  | 'appBar'
  | 'body'
  | 'callout'
  | 'meta'
  | 'caption'
  | 'button'
  | 'buttonSmall';

export type TypeVariant = {
  fontSize: number;
  lineHeight: number;
  /** Em pontos (o CSS usa em; já convertido para o tamanho do texto). */
  letterSpacing: number;
  weight: FontWeightName;
  /** Usa o corte Display quando o peso for semibold. */
  display?: boolean;
};

/**
 * Escala tipográfica do protótipo: 26 / 24 / 22 / 20 / 18 / 17 / 15 / 14 / 13 / 12.
 * Hierarquia só por tamanho e peso.
 */
export const typeScale: Record<TypeVariantName, TypeVariant> = {
  /** Números de destaque (".stat b"): 26/32, semibold. */
  display: {
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.26,
    weight: 'semibold',
    display: true,
  },
  /** Saudação do Início (".greet h2"): 24/30, semibold. */
  titleXL: {
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.24,
    weight: 'semibold',
    display: true,
  },
  /** Título de tela/entidade (login, disciplina, Sobre, horário da próxima aula): 22/28. */
  titleL: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.22,
    weight: 'semibold',
    display: true,
  },
  /** Título de passo do gerador (".step-t"): 20/26. */
  titleM: {
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
    weight: 'semibold',
  },
  /** Título de folha inferior e de conversa (".sheet-head h2", ".chat-name"): 18/24. */
  titleS: {
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.18,
    weight: 'semibold',
  },
  /** Título de seção (".sec-h h2") e nome da próxima aula: 17/24. */
  headline: {
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.17,
    weight: 'semibold',
  },
  /** Título do cabeçalho azul (".appbar h1"): 17/24, medium. */
  appBar: {
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.17,
    weight: 'medium',
  },
  /** Texto de lista, campo e mensagem (".r-title", ".r-label", ".msg-t"): 15/21. */
  body: { fontSize: 15, lineHeight: 21, letterSpacing: 0, weight: 'regular' },
  /** Texto corrido padrão da tela (14/20): descrições, subtítulos, chips. */
  callout: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
    weight: 'regular',
  },
  /** Metadado de lista e avisos (".r-meta", ".notice"): 13/18. */
  meta: { fontSize: 13, lineHeight: 18, letterSpacing: 0, weight: 'regular' },
  /** Legenda, cabeçalho de tabela, tag e status (".st", ".tag", "th"): 12/16. */
  caption: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
    weight: 'medium',
  },
  /** Rótulo de botão (".btn"): 15/20, semibold. */
  button: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0,
    weight: 'semibold',
  },
  /** Rótulo de botão pequeno (".btn-sm", ".tbtn"): 14/20, semibold. */
  buttonSmall: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
    weight: 'semibold',
  },
};

/* -------------------------------------------------------------- espaçamento */

/** Escala de espaçamento (px/dp). Valores ímpares do CSS ficam nos componentes. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

/** Medidas de layout derivadas do protótipo. */
export const layout = {
  /** Margem lateral do conteúdo do painel (".panel-scroll" padding 20). */
  gutter: 20,
  /** Respiro no topo do painel, abaixo da curva de 48px. */
  panelPaddingTop: 32,
  /** Respiro no fim da rolagem. */
  panelPaddingBottom: 40,
  /** Raio do canto superior esquerdo do painel sobre o azul. */
  panelRadius: 48,
  /** Espaço entre seções (".sec" margin-top 30). */
  sectionGap: 30,
  /** Espaço entre o título da seção e o conteúdo (".sec-h" margin-bottom 10). */
  sectionHeaderGap: 10,
  /** Altura mínima da linha de título de seção (".sec-h" min-height 32). */
  sectionHeaderMinHeight: 32,
  /** Altura da barra azul do cabeçalho (sem a barra de status). */
  appBarHeight: 52,
  /** Largura do menu lateral. */
  drawerWidth: 300,
  /** Altura máxima da folha inferior, em fração da tela. */
  sheetMaxHeight: 0.86,
} as const;

/* ------------------------------------------------------------------- raios */

/**
 * Raios. A assinatura do app é o "canto cortado": o raio vale nos cantos,
 * exceto o superior direito, que é reto (`border-top-right-radius: 0`).
 */
export const radii = {
  none: 0,
  /** Quadradinho de legenda (".sq"). */
  xs: 4,
  /** Checkbox. */
  checkbox: 5,
  /** Tag, célula de nota. */
  sm: 6,
  /** Chip, alerta do RID, bloco da grade. */
  md: 8,
  /** Botão, campo, controle segmentado, aviso, ícone de linha. */
  lg: 10,
  /** Card, grupo de campos do login, seletor de dias, eventos da agenda. */
  xl: 12,
  /** Ícone do estado vazio. */
  xxl: 20,
  /** Topo da folha inferior. */
  sheet: 24,
  /** Canto superior esquerdo do painel sobre o azul. */
  panel: 48,
  pill: 999,
} as const;

/** Bordas. O sistema usa fios de 1px; foco e erro somam 1px (2px no total). */
export const borders = {
  hairline: 1,
  focus: 2,
} as const;

/* ------------------------------------------------------------------ medidas */

export const sizes = {
  /** Alvo de toque mínimo (dp). */
  touch: 48,
  /** Altura mínima de linha de lista (".r"). */
  row: 56,
  /** Campo de texto e botão. */
  field: 48,
  /** Seletor (".select"). */
  select: 52,
  /** Linha do grupo de campos do login (".frow"). */
  fieldGroupRow: 56,
  /** Chip (o alvo de toque é ampliado para 48). */
  chip: 36,
  tag: 24,
  /** Célula de nota (".gp"). */
  gradeCell: { width: 40, height: 28 },
  gradeCellLarge: { width: 48, height: 32 },
  avatar: 40,
  /** Ícone em caixa (".r-ic", ".new-ic"). */
  iconTile: 40,
  /** Ícone do estado vazio (".empty-ic"). */
  emptyIcon: 64,
  icon: { xs: 15, sm: 16, md: 18, lg: 20, xl: 22, xxl: 24, empty: 30 },
  switch: { width: 52, height: 32 },
  checkbox: 20,
  stepNumber: 24,
  progressBar: 6,
  progressBarThin: 4,
} as const;

/* ------------------------------------------------------------------ movimento */

/** Movimento só para estado: 150–250ms. Respeite "remover animações". */
export const motion = {
  fast: 150,
  base: 200,
  slow: 250,
  /** cubic-bezier(.2,.8,.2,1) do protótipo. */
  easing: [0.2, 0.8, 0.2, 1] as const,
} as const;
