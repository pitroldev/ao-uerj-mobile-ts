import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { EdgeFade } from '../EdgeFade';
import { Icon, type IconName } from '../Icon';
import { Text } from '../Text';

export type FilterChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Ícone à esquerda quando desmarcado (marcado mostra o "check"). */
  icon?: IconName;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const Chip = styled.Pressable<{ $selected: boolean; $icon: boolean }>`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  min-height: ${({ theme }) => theme.sizes.chip}px;
  padding: 0px 14px 0px ${({ $icon }) => ($icon ? 10 : 14)}px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme, $selected }) =>
    $selected ? theme.colors.accentLine : theme.colors.ruleStrong};
  border-radius: ${({ theme }) => theme.radii.md}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme, $selected }) =>
    $selected ? theme.colors.accentSoft : theme.colors.surface};
`;

/** O alvo de toque cresce para 48dp sem mudar o desenho de 36dp. */
const HIT_SLOP = { top: 6, bottom: 6 };

/**
 * Chip de filtro (".chip"): 36dp de altura com alvo de toque ampliado para
 * 48dp, canto cortado. Marcado: fundo de acento suave e "check".
 */
export function FilterChip({
  label,
  selected = false,
  onPress,
  icon,
  disabled = false,
  accessibilityLabel,
  style,
}: FilterChipProps) {
  const theme = useTheme();
  const c = theme.colors;
  const fg = disabled ? c.inkMuted : selected ? c.accent : c.ink;
  const glyph: IconName | undefined = selected ? 'check' : icon;
  return (
    <Chip
      $selected={selected}
      $icon={Boolean(glyph)}
      onPress={onPress}
      disabled={disabled}
      hitSlop={HIT_SLOP}
      accessibilityRole="togglebutton"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: selected, disabled }}
      style={({ pressed }) => [
        pressed && !selected && { backgroundColor: c.surfaceMuted },
        style,
      ]}
    >
      {glyph ? (
        <Icon name={glyph} size={theme.sizes.icon.md} color={fg} />
      ) : null}
      <Text weight="medium" color={fg} numberOfLines={1}>
        {label}
      </Text>
    </Chip>
  );
}

export type ChipGroupProps = {
  children?: React.ReactNode;
  /**
   * `scroll`: uma linha rolável que sangra até as bordas do painel (filtros
   * de tipo). `wrap`: quebra em várias linhas (sugestões do gerador).
   */
  layout?: 'scroll' | 'wrap';
  /**
   * Cor do fundo atrás da linha rolável, para o esmaecimento das bordas.
   * Padrão `theme.colors.surface`.
   */
  fadeColor?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** A linha sangra até as bordas do painel; as bordas esmaecem 20dp. */
const Bleed = styled.View`
  margin: 0px ${({ theme }) => -theme.layout.gutter}px;
`;

const Scroller = styled.ScrollView`
  flex-grow: 0;
`;

const FADE_WIDTH = 20;

const Wrap = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
`;

/** Grupo de `FilterChip` com espaçamento de 8. */
export function ChipGroup({
  children,
  layout = 'wrap',
  fadeColor,
  accessibilityLabel,
  style,
}: ChipGroupProps) {
  const theme = useTheme();
  if (layout === 'scroll') {
    return (
      <Bleed style={style}>
        <Scroller
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityLabel={accessibilityLabel}
          contentContainerStyle={{
            gap: theme.spacing.sm,
            paddingHorizontal: theme.layout.gutter,
            paddingVertical: theme.spacing.xs + 2,
          }}
        >
          {children}
        </Scroller>
        <EdgeFade side="start" width={FADE_WIDTH} color={fadeColor} />
        <EdgeFade side="end" width={FADE_WIDTH} color={fadeColor} />
      </Bleed>
    );
  }
  return (
    <Wrap accessibilityLabel={accessibilityLabel} style={style}>
      {children}
    </Wrap>
  );
}

export default FilterChip;
