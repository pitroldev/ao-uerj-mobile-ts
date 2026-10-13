import React from 'react';
import {
  Text as RNText,
  type TextInstance,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';
import { useTheme, type DefaultTheme } from 'styled-components/native';

import type { FontWeightName, TypeVariantName } from '@root/themes/tokens';

export type TextTone =
  | 'ink'
  | 'muted'
  | 'subtle'
  | 'accent'
  | 'onFill'
  | 'onBrand'
  | 'onBrandMuted'
  | 'good'
  | 'warn'
  | 'bad'
  | 'neutral';

export type TextProps = RNTextProps & {
  /** Papel tipográfico (tamanho, entrelinha e espaçamento). Padrão `callout`. */
  variant?: TypeVariantName;
  /** Sobrescreve o peso padrão da variante (troca a família do Inter). */
  weight?: FontWeightName;
  /** Cor semântica. Padrão `ink`. */
  tone?: TextTone;
  /** Cor literal; tem prioridade sobre `tone`. */
  color?: string;
  /** Algarismos tabulares, para números alinhados em colunas. */
  tabular?: boolean;
  align?: TextStyle['textAlign'];
};

function toneColor(theme: DefaultTheme, tone: TextTone): string {
  switch (tone) {
    case 'muted':
      return theme.colors.inkMuted;
    case 'subtle':
      return theme.colors.inkSubtle;
    case 'accent':
      return theme.colors.accent;
    case 'onFill':
      return theme.colors.onFill;
    case 'onBrand':
      return theme.colors.onBrand;
    case 'onBrandMuted':
      return theme.colors.onBrandMuted;
    case 'good':
    case 'warn':
    case 'bad':
    case 'neutral':
      return theme.status[tone].ink;
    default:
      return theme.colors.ink;
  }
}

/**
 * Estilo tipográfico pronto para `style` (família, tamanho, entrelinha e
 * espaçamento). Use em componentes que não renderizam o `Text`, como
 * `TextInput`.
 */
export function typeStyle(
  theme: DefaultTheme,
  variant: TypeVariantName = 'callout',
  weight?: FontWeightName,
): TextStyle {
  const v = theme.typography[variant];
  const w = weight ?? v.weight;
  const fontFamily =
    v.display && w === 'semibold'
      ? theme.fonts.displaySemibold
      : theme.fonts[w];
  return {
    fontFamily,
    fontSize: v.fontSize,
    lineHeight: v.lineHeight,
    letterSpacing: v.letterSpacing,
  };
}

const TABULAR: TextStyle['fontVariant'] = ['tabular-nums'];

/**
 * Texto do design system. Respeita o tamanho de fonte do sistema (não
 * desligue `allowFontScaling`). O peso vem da família; não use `fontWeight`.
 */
export const Text = React.forwardRef<TextInstance, TextProps>(function (
  {
    variant = 'callout',
    weight,
    tone = 'ink',
    color,
    tabular = false,
    align,
    style,
    ...rest
  },
  ref,
) {
  const theme = useTheme();
  return (
    <RNText
      ref={ref}
      style={[
        typeStyle(theme, variant, weight),
        { color: color ?? toneColor(theme, tone) },
        tabular ? { fontVariant: TABULAR } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    />
  );
});
Text.displayName = 'Text';
