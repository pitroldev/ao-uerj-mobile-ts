import React, { memo } from 'react';
import { useWindowDimensions } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Icon, Text } from '@components/ui';
import { WEEKDAY_DICTIONARY } from '@utils/constants/time';

import type { TimeSlot } from '../../format';

/* ------------------------------------------------------------ topo do passo */

/** Título, atalhos e legenda; o fim deixa 8 até a tabela (".busy" margin-top). */
export const Top = styled.View`
  padding-bottom: 8px;
`;

/** Atalhos de turno (".busy-tools"): rótulo e botões de texto alternáveis. */
export const Tools = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 2px;
  margin: 12px 0px 0px -2px;
`;

export const ToolsLabel = styled(Text)`
  margin-right: 4px;
`;

/**
 * Manhã, Tarde e Noite ficam juntos: sem espaço ao lado do rótulo (fonte do
 * sistema grande), o grupo inteiro desce para a linha de baixo.
 */
export const ToolsGroup = styled.View`
  flex-direction: row;
  align-items: center;
  column-gap: 2px;
`;

/**
 * Legenda e "Limpar tudo" (".busy-bar"). O botão fica ao lado enquanto a
 * legenda tiver pelo menos 60% da linha; com a fonte do sistema grande ele
 * desce para a linha de baixo, ainda à direita. A decisão não depende do
 * texto da contagem, então a tabela não pula ao marcar o primeiro tempo.
 */
export const LegendBar = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 12px;
  margin-top: 2px;
`;

/**
 * Pares quadradinho+rótulo: quebra só entre os pares, nunca dentro de um.
 * Duas linhas de legenda (40) cabem na altura do botão (48), então quebrar
 * "Livre" para baixo não muda a altura da barra.
 */
export const Legend = styled.View`
  flex-grow: 1;
  flex-shrink: 1;
  flex-basis: 0px;
  min-width: 60%;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 16px;
  row-gap: 4px;
`;

/** Um par da legenda (".busy-count" > i + span): não se separa. */
export const LegendItem = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  max-width: 100%;
`;

/** Rótulo do par: só quebra por dentro se o par sozinho não couber na linha. */
export const LegendLabel = styled(Text)`
  flex-shrink: 1;
`;

/** Quadradinho da legenda (".sq"): ocupado em vermelho claro, livre em branco. */
export const LegendSquare = styled.View<{ $busy: boolean }>`
  width: 16px;
  height: 16px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme, $busy }) =>
    $busy ? theme.status.bad.line : theme.colors.ruleStrong};
  background-color: ${({ theme, $busy }) =>
    $busy ? theme.status.bad.bg : theme.colors.surface};
  border-radius: ${({ theme }) => theme.radii.xs}px;
  border-top-right-radius: 0px;
`;

/**
 * O texto do botão alinha com a margem direita (".tbtn" margin-right -10);
 * `margin-left: auto` o mantém à direita também quando desce de linha.
 */
export const ClearSlot = styled.View`
  margin-left: auto;
  margin-right: -10px;
`;

/* ------------------------------------------------------- tabela da semana */

const TIME_COLUMN = 52;
/**
 * Recuo do rótulo do tempo e largura reservada para "10:40" em ems (o texto
 * mede ~2,7em em Inter tabular; a folga evita a quebra no Android).
 */
const TIME_PADDING = 12;
const TIME_TEXT_EMS = 3.3;

/**
 * Largura da coluna dos tempos: 52 no padrão e cresce com a fonte do sistema,
 * para "10:40" nunca quebrar no meio.
 */
export function useTimeColumnWidth(): number {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const text = theme.typography.caption.fontSize * (fontScale || 1);
  return Math.max(TIME_COLUMN, Math.ceil(TIME_PADDING + text * TIME_TEXT_EMS));
}

/** Cabeçalho dos dias (".busy-head"), preso no topo ao rolar. */
export const GridHead = styled.View`
  flex-direction: row;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme }) => theme.colors.ruleStrong};
  border-top-left-radius: ${({ theme }) => theme.radii.xl}px;
  background-color: ${({ theme }) => theme.colors.surface};
  overflow: hidden;
`;

export const HeadSpacer = styled.View<{ $width: number }>`
  width: ${({ $width }) => $width}px;
`;

export const DayHead = styled.Pressable`
  flex: 1;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  border-left-width: ${({ theme }) => theme.borders.hairline}px;
  border-left-color: ${({ theme }) => theme.colors.rule};
`;

/** Corpo da tabela: só fios, sem caixa por célula (".busy"). */
export const GridBody = styled.View`
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-top-width: 0px;
  border-color: ${({ theme }) => theme.colors.ruleStrong};
  border-bottom-left-radius: ${({ theme }) => theme.radii.xl}px;
  border-bottom-right-radius: ${({ theme }) => theme.radii.xl}px;
  overflow: hidden;
`;

/** Faixa do turno (".busy-shift"): "Manhã  M1–M6". */
export const ShiftBand = styled.View<{ $first: boolean }>`
  flex-direction: row;
  align-items: baseline;
  gap: 8px;
  min-height: 32px;
  padding: 7px 12px 0px;
  background-color: ${({ theme }) => theme.colors.surfaceMuted};
  border-top-width: ${({ theme, $first }) =>
    $first ? 0 : theme.borders.hairline}px;
  border-top-color: ${({ theme }) => theme.colors.rule};
`;

export const ShiftRow = styled.View`
  flex-direction: row;
  border-top-width: ${({ theme }) => theme.borders.hairline}px;
  border-top-color: ${({ theme }) => theme.colors.rule};
`;

const TimeLabel = styled.View<{ $width: number }>`
  width: ${({ $width }) => $width}px;
  justify-content: center;
  padding-left: ${TIME_PADDING}px;
`;

/** Tempo e horário de início (".busy-t"): "M1" em cima, "7:00" embaixo. */
export function RowTime({
  alias,
  start,
  width,
}: {
  alias: string;
  start: string;
  width: number;
}) {
  return (
    <TimeLabel
      $width={width}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text variant="caption" weight="semibold">
        {alias}
      </Text>
      <Text variant="caption" weight="regular" tone="muted" tabular>
        {start}
      </Text>
    </TimeLabel>
  );
}

const Cell = styled.Pressable<{ $selected: boolean }>`
  flex: 1;
  min-height: ${({ theme }) => theme.sizes.touch}px;
  align-items: center;
  justify-content: center;
  border-left-width: ${({ theme }) => theme.borders.hairline}px;
  border-left-color: ${({ theme }) => theme.colors.rule};
  background-color: ${({ theme, $selected }) =>
    $selected ? theme.status.bad.bg : theme.colors.surface};
`;

type WeekDayNumber = keyof typeof WEEKDAY_DICTIONARY;

type BusyCellProps = {
  weekDay: WeekDayNumber;
  time: TimeSlot;
  selected: boolean;
  /** Toque: marca ou desmarca este tempo neste dia. */
  onToggle: (weekDay: WeekDayNumber, time: TimeSlot) => void;
  /** Toque longo: marca ou desmarca este tempo em todos os dias. */
  onToggleRow: (time: TimeSlot) => void;
};

const ROW_ACTION = [
  { name: 'longpress', label: 'Marcar este horário em todos os dias' },
];

/**
 * Célula da tabela (".cell"): 48dp, só a ocupada é preenchida, com o ícone
 * "block" para não depender só da cor.
 */
export const BusyCell = memo(function BusyCell({
  weekDay,
  time,
  selected,
  onToggle,
  onToggleRow,
}: BusyCellProps) {
  const theme = useTheme();
  const day = WEEKDAY_DICTIONARY[weekDay].name;
  return (
    <Cell
      $selected={selected}
      onPress={() => onToggle(weekDay, time)}
      onLongPress={() => onToggleRow(time)}
      delayLongPress={500}
      accessibilityRole="togglebutton"
      accessibilityLabel={`${day}, ${time.periodAlias}, ${time.startTimeAlias} às ${time.endTimeAlias}`}
      accessibilityState={{ checked: selected }}
      accessibilityHint="Toque e segure para marcar este horário em todos os dias."
      accessibilityActions={ROW_ACTION}
      onAccessibilityAction={e => {
        if (e.nativeEvent.actionName === 'longpress') onToggleRow(time);
      }}
      style={({ pressed }) =>
        pressed && !selected && { backgroundColor: theme.colors.surfaceMuted }
      }
    >
      {selected ? (
        <Icon
          name="block"
          size={theme.sizes.icon.md}
          color={theme.status.bad.ink}
        />
      ) : null}
    </Cell>
  );
});
