import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Icon, type IconName } from '../Icon';
import { toneColors, type UiTone } from '../tones';

export type IconTileProps = {
  icon: IconName;
  /**
   * `accent` (padrão, linhas do Sobre e Novidades), `bad` (erro), `muted`
   * (estado vazio) ou qualquer tom de status.
   */
  tone?: UiTone | 'muted';
  /** `md` 40dp (linha de lista), `lg` 64dp (estado vazio). */
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
};

const Tile = styled.View<{ $side: number; $radius: number; $bg: string }>`
  width: ${({ $side }) => $side}px;
  height: ${({ $side }) => $side}px;
  border-radius: ${({ $radius }) => $radius}px;
  border-top-right-radius: 0px;
  background-color: ${({ $bg }) => $bg};
  align-items: center;
  justify-content: center;
`;

/** Ícone em caixa de canto cortado (".r-ic", ".new-ic", ".empty-ic"). */
export function IconTile({
  icon,
  tone = 'accent',
  size = 'md',
  style,
}: IconTileProps) {
  const theme = useTheme();
  const lg = size === 'lg';
  const colors =
    tone === 'muted'
      ? { bg: theme.colors.surfaceMuted, ink: theme.colors.inkMuted }
      : toneColors(theme, tone);
  return (
    <Tile
      $side={lg ? theme.sizes.emptyIcon : theme.sizes.iconTile}
      $radius={lg ? theme.radii.xxl : theme.radii.lg}
      $bg={colors.bg}
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Icon
        name={icon}
        size={lg ? theme.sizes.icon.empty : theme.sizes.icon.xl}
        color={colors.ink}
      />
    </Tile>
  );
}
