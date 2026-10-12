import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Icon, type IconName } from '../Icon';
import { Text } from '../Text';

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: IconName;
  accessibilityLabel?: string;
};

export type SegmentedControlProps<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Descreve o grupo ("Situação", "Grades geradas"). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const Root = styled.View`
  flex-direction: row;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme }) => theme.colors.ruleStrong};
  border-radius: ${({ theme }) => theme.radii.lg}px;
  border-top-right-radius: 0px;
  overflow: hidden;
`;

const Segment = styled.Pressable<{ $selected: boolean; $first: boolean }>`
  flex: 1;
  min-height: ${({ theme }) => theme.sizes.touch}px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0px 8px;
  border-left-width: ${({ theme, $first }) =>
    $first ? 0 : theme.borders.hairline}px;
  border-left-color: ${({ theme }) => theme.colors.ruleStrong};
  background-color: ${({ theme, $selected }) =>
    $selected ? theme.colors.accentSoft : theme.colors.surface};
`;

/**
 * Controle segmentado (".segm"): colunas iguais com fio entre elas, canto
 * cortado; o selecionado ganha fundo de acento suave e "check".
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  style,
}: SegmentedControlProps<T>) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Root
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      {options.map((opt, i) => {
        const selected = opt.value === value;
        const fg = selected ? c.accent : c.ink;
        const glyph = selected ? 'check' : opt.icon;
        return (
          <Segment
            key={opt.value}
            $selected={selected}
            $first={i === 0}
            onPress={() => onChange(opt.value)}
            accessibilityRole="tab"
            accessibilityLabel={opt.accessibilityLabel ?? opt.label}
            accessibilityState={{ selected }}
            style={({ pressed }) =>
              pressed && !selected && { backgroundColor: c.surfaceMuted }
            }
          >
            {glyph ? (
              <Icon name={glyph} size={theme.sizes.icon.md} color={fg} />
            ) : null}
            <Text
              weight={selected ? 'semibold' : 'medium'}
              color={fg}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Segment>
        );
      })}
    </Root>
  );
}

export default SegmentedControl;
