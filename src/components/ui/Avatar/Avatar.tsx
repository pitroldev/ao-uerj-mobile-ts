import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Text } from '../Text';

/** "Marina Albuquerque Teixeira" → "MT" (primeira e última palavra). */
export function initials(name: string | null | undefined): string {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '';
  const first = words[0][0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

export type AvatarProps = {
  /** Nome completo; o avatar mostra as iniciais. */
  name: string;
  /** `brand`: sobre o azul do menu. `accent`: sobre superfícies claras (Sobre). */
  tone?: 'brand' | 'accent';
  size?: number;
  style?: StyleProp<ViewStyle>;
};

const Circle = styled.View<{ $side: number; $brand: boolean }>`
  width: ${({ $side }) => $side}px;
  height: ${({ $side }) => $side}px;
  border-radius: ${({ $side }) => $side / 2}px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme, $brand }) =>
    $brand ? theme.colors.brandHighlight : theme.colors.accentSoft};
  border-width: ${({ $brand }) => ($brand ? 1 : 0)}px;
  border-color: ${({ theme }) => theme.colors.onBrandRing};
`;

const Initials = styled(Text)`
  letter-spacing: 0.28px;
`;

/** Avatar de iniciais em círculo (".avatar"). Decorativo: o nome vem ao lado. */
export function Avatar({ name, tone = 'accent', size, style }: AvatarProps) {
  const theme = useTheme();
  const brand = tone === 'brand';
  return (
    <Circle
      $side={size ?? theme.sizes.avatar}
      $brand={brand}
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Initials
        weight="semibold"
        color={brand ? theme.colors.onBrand : theme.colors.accent}
        maxFontSizeMultiplier={1.2}
      >
        {initials(name)}
      </Initials>
    </Circle>
  );
}
