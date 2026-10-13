import React, { createContext, useContext, useMemo } from 'react';
import type { GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';
import styled, { css, useTheme } from 'styled-components/native';

import { Text } from '../Text';

export type TableColumn = {
  key: string;
  /** Rótulo do cabeçalho ("P1", "Freq."). Vazio para coluna sem título. */
  label: string;
  /** Largura fixa em dp (colunas numéricas: 45 no quadro de notas). */
  width?: number;
  /** Peso flexível (padrão 1 quando não há `width`). */
  flex?: number;
  align?: 'left' | 'center' | 'right';
};

type TableContextValue = {
  columns: TableColumn[];
  verticalAlign: 'center' | 'top';
  rowPadding: number;
};

const TableContext = createContext<TableContextValue>({
  columns: [],
  verticalAlign: 'center',
  rowPadding: 10,
});

export type TableProps = {
  columns: TableColumn[];
  children?: React.ReactNode;
  /** Alinhamento vertical das células. `top` para linhas altas (histórico). */
  verticalAlign?: 'center' | 'top';
  /** Padding vertical das linhas. 10 (notas) ou 12 (histórico). */
  rowPadding?: number;
  /** Esconde o cabeçalho de colunas. */
  hideHeader?: boolean;
  /** Descrição da tabela para leitores de tela ("Notas do período 2026.2"). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const ALIGN = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
} as const;

const Cell = styled.View<{
  $col?: TableColumn;
  $first: boolean;
  $multi: boolean;
}>`
  ${({ $col }) =>
    $col?.width != null
      ? `width: ${$col.width}px;`
      : `flex: ${$col?.flex ?? 1}; min-width: 0px;`}
  align-items: ${({ $col }) => ALIGN[$col?.align ?? 'left']};
  ${({ $first, $multi }) => ($first && $multi ? 'padding-right: 8px;' : '')}
`;

const Wrapper = styled.View``;

/**
 * Linha de cabeçalho (".gt"/".tt" thead) com o fio embaixo. No escuro ela
 * sobe um degrau: faixa `surface` 10dp mais larga que a tabela de cada lado.
 * No claro a superfície é o próprio fundo, então fica só o fio.
 */
export const tableHeaderCss = css`
  flex-direction: row;
  border-bottom-width: ${({ theme }) => theme.borders.hairline}px;
  border-bottom-color: ${({ theme }) => theme.colors.rule};
  ${({ theme }) =>
    theme.name === 'dark'
      ? `padding: 7px 10px; margin: 0px -10px; background-color: ${theme.colors.surface};`
      : `padding-bottom: ${theme.spacing.sm}px;`}
`;

const Header = styled.View`
  ${tableHeaderCss}
`;

type RowStyle = { $top: boolean; $padding: number; $divider: boolean };

const rowCss = css<RowStyle>`
  flex-direction: row;
  align-items: ${({ $top }) => ($top ? 'flex-start' : 'center')};
  padding: ${({ $padding }) => $padding}px 0px;
  border-bottom-width: ${({ theme, $divider }) =>
    $divider ? theme.borders.hairline : 0}px;
  border-bottom-color: ${({ theme }) => theme.colors.rule};
`;

const StaticRow = styled.View<RowStyle>`
  ${rowCss}
`;

const PressableRow = styled.Pressable<RowStyle>`
  ${rowCss}
`;

/**
 * Tabela compacta de fios (".gt"/".tt"): cabeçalho de colunas em legenda
 * secundária e linhas separadas por fios de 1px. Sem bordas verticais.
 */
export function Table({
  columns,
  children,
  verticalAlign = 'center',
  rowPadding = 10,
  hideHeader = false,
  accessibilityLabel,
  style,
}: TableProps) {
  const value = useMemo(
    () => ({ columns, verticalAlign, rowPadding }),
    [columns, verticalAlign, rowPadding],
  );
  return (
    <TableContext.Provider value={value}>
      <Wrapper style={style} accessibilityLabel={accessibilityLabel}>
        {!hideHeader ? (
          <Header>
            {columns.map((col, i) => (
              <Cell
                key={col.key}
                $col={col}
                $first={i === 0}
                $multi={columns.length > 1}
              >
                <Text
                  variant="caption"
                  tone="muted"
                  align={col.align ?? 'left'}
                >
                  {col.label}
                </Text>
              </Cell>
            ))}
          </Header>
        ) : null}
        {children}
      </Wrapper>
    </TableContext.Provider>
  );
}

export type TableRowProps = {
  /** Uma célula por coluna, na ordem de `columns`. */
  children?: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  /** Resumo da linha para leitores de tela (agrupa as células). */
  accessibilityLabel?: string;
  /** Sem fio inferior. */
  noDivider?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Linha da `Table`. Cada filho ocupa a coluna correspondente. */
export function TableRow({
  children,
  onPress,
  accessibilityLabel,
  noDivider = false,
  style,
}: TableRowProps) {
  const theme = useTheme();
  const { columns, verticalAlign, rowPadding } = useContext(TableContext);
  const cells = React.Children.toArray(children).map((cell, i) => (
    <Cell
      key={i}
      $col={columns[i]}
      $first={i === 0}
      $multi={columns.length > 1}
    >
      {cell}
    </Cell>
  ));
  const rowProps = {
    $top: verticalAlign === 'top',
    $padding: rowPadding,
    $divider: !noDivider,
  };
  if (onPress) {
    return (
      <PressableRow
        {...rowProps}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          pressed && { backgroundColor: theme.colors.surfaceMuted },
          style,
        ]}
      >
        {cells}
      </PressableRow>
    );
  }
  return (
    <StaticRow
      {...rowProps}
      style={style}
      accessible={Boolean(accessibilityLabel) || undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {cells}
    </StaticRow>
  );
}
