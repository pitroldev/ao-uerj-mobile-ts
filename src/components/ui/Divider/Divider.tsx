import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled from 'styled-components/native';

import { Text } from '../Text';

export type DividerProps = {
  /** Recuo à esquerda (ex.: 20 para alinhar com o texto de uma lista sangrada). */
  inset?: number;
  /** Fio forte (`ruleStrong`) em vez do padrão (`rule`). */
  strong?: boolean;
  /** Fio vertical (ocupa a altura do pai; use dentro de linhas). */
  vertical?: boolean;
  /**
   * Texto no fio: `start` = "Grupo 1 ————" (requisitos), `center` =
   * "——— Hoje ———" (separador de dia no mural).
   */
  label?: string;
  labelAlign?: 'start' | 'center';
  /** Margem vertical (fio horizontal). */
  spacing?: number;
  style?: StyleProp<ViewStyle>;
};

type LineProps = { $strong: boolean };

const HLine = styled.View<LineProps & { $inset: number; $spacing: number }>`
  height: ${({ theme }) => theme.borders.hairline}px;
  margin-left: ${({ $inset }) => $inset}px;
  margin-top: ${({ $spacing }) => $spacing}px;
  margin-bottom: ${({ $spacing }) => $spacing}px;
  background-color: ${({ theme, $strong }) =>
    $strong ? theme.colors.ruleStrong : theme.colors.rule};
`;

const VLine = styled.View<LineProps>`
  width: ${({ theme }) => theme.borders.hairline}px;
  align-self: stretch;
  background-color: ${({ theme, $strong }) =>
    $strong ? theme.colors.ruleStrong : theme.colors.rule};
`;

const FlexLine = styled.View<LineProps>`
  flex: 1;
  height: ${({ theme }) => theme.borders.hairline}px;
  background-color: ${({ theme, $strong }) =>
    $strong ? theme.colors.ruleStrong : theme.colors.rule};
`;

const LabelRow = styled.View<{
  $center: boolean;
  $inset: number;
  $spacing: number;
}>`
  flex-direction: row;
  align-items: center;
  gap: ${({ $center }) => ($center ? 12 : 10)}px;
  margin-left: ${({ $inset }) => $inset}px;
  margin-top: ${({ $spacing }) => $spacing}px;
  margin-bottom: ${({ $spacing }) => $spacing}px;
`;

/** Fio de 1px do sistema, opcionalmente com rótulo. */
export function Divider({
  inset = 0,
  strong = false,
  vertical = false,
  label,
  labelAlign = 'start',
  spacing = 0,
  style,
}: DividerProps) {
  if (vertical) {
    return (
      <VLine
        $strong={strong}
        style={style}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }

  if (label) {
    const center = labelAlign === 'center';
    return (
      <LabelRow
        $center={center}
        $inset={inset}
        $spacing={spacing}
        style={style}
      >
        {center ? <FlexLine $strong={strong} /> : null}
        <Text
          variant={center ? 'caption' : 'meta'}
          weight={center ? 'medium' : 'semibold'}
          tone="muted"
          accessibilityRole="header"
        >
          {label}
        </Text>
        <FlexLine $strong={strong} />
      </LabelRow>
    );
  }

  return (
    <HLine
      $strong={strong}
      $inset={inset}
      $spacing={spacing}
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

export default Divider;
