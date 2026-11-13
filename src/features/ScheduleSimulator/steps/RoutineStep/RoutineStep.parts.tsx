import React, { memo } from 'react';
import { useWindowDimensions } from 'react-native';
import styled, { useTheme, type DefaultTheme } from 'styled-components/native';

import { Icon, Text } from '@components/ui';
import { WEEKDAY_DICTIONARY } from '@utils/constants/time';

import type { TimeSlot } from '../../format';

/* ------------------------------------------------------------ topo do passo */

/** Título, atalhos e legenda; o fim deixa 8 até a tabela (".busy" margin-top). */
export const Top = styled.View`
  padding-bottom: 8px;
`;

/** Atalhos de turno e do sábado (".busy-tools"): botões de texto alternáveis. */
export const Tools = styled.View`
  margin: 8px 0px 0px -12px;
`;

/** Os quatro atalhos numa linha; com a fonte do sistema grande, quebram. */
export const ToolsGroup = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
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

/**
 * O tom da janela do almoço. É uma preferência, não um bloqueio: no escuro,
 * onde o `wash` de atenção é um marrom forte, ele vai a 55% para não pesar
 * como um horário ocupado nas 18 células da faixa.
 */
const lunchWash = (theme: DefaultTheme) =>
  theme.name === 'dark'
    ? `${theme.status.warn.wash}8C`
    : theme.status.warn.wash;

/**
 * Quadradinho da legenda (".sq"): ocupado no tom crítico, almoço no tom
 * quente, livre no fundo.
 */
export const LegendSquare = styled.View<{ $busy?: boolean; $lunch?: boolean }>`
  width: 16px;
  height: 16px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme, $busy, $lunch }) =>
    $busy
      ? theme.status.bad.washLine
      : $lunch
        ? theme.status.warn.washLine
        : theme.colors.ruleStrong};
  background-color: ${({ theme, $busy, $lunch }) =>
    $busy
      ? theme.status.bad.wash
      : $lunch
        ? lunchWash(theme)
        : theme.colors.background};
  border-radius: ${({ theme }) => theme.radii.xs}px;
  border-top-right-radius: 0px;
  align-items: center;
  justify-content: center;
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
  border-left-color: ${({ theme }) => theme.colors.gridRule};
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
  border-top-color: ${({ theme }) => theme.colors.gridRule};
`;

export const ShiftRow = styled.View`
  flex-direction: row;
  border-top-width: ${({ theme }) => theme.borders.hairline}px;
  border-top-color: ${({ theme }) => theme.colors.gridRule};
`;

const TimeLabel = styled.View<{ $width: number }>`
  width: ${({ $width }) => $width}px;
  justify-content: center;
  padding-left: ${TIME_PADDING}px;
`;

const AliasRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 2px;
`;

/**
 * Tempo e horário de início (".busy-t"): "M1" em cima, "7:00" embaixo. Na
 * janela do almoço (com ele ligado), o garfo ao lado do tempo.
 */
export function RowTime({
  alias,
  start,
  width,
  lunch = false,
}: {
  alias: string;
  start: string;
  width: number;
  lunch?: boolean;
}) {
  const theme = useTheme();
  return (
    <TimeLabel
      $width={width}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <AliasRow>
        <Text variant="caption" weight="semibold">
          {alias}
        </Text>
        {lunch ? (
          <Icon name="restaurant" size={12} color={theme.status.warn.ink} />
        ) : null}
      </AliasRow>
      <Text variant="caption" weight="regular" tone="muted" tabular>
        {start}
      </Text>
    </TimeLabel>
  );
}

const Cell = styled.Pressable<{ $selected: boolean; $lunch: boolean }>`
  flex: 1;
  min-height: ${({ theme }) => theme.sizes.touch}px;
  align-items: center;
  justify-content: center;
  border-left-width: ${({ theme }) => theme.borders.hairline}px;
  border-left-color: ${({ theme }) => theme.colors.gridRule};
  background-color: ${({ theme, $selected, $lunch }) =>
    $selected
      ? theme.status.bad.wash
      : $lunch
        ? lunchWash(theme)
        : theme.colors.background};
`;

type WeekDayNumber = keyof typeof WEEKDAY_DICTIONARY;

type BusyCellProps = {
  weekDay: WeekDayNumber;
  time: TimeSlot;
  selected: boolean;
  /** Quantas das disciplinas escolhidas têm turma neste tempo. */
  classes?: number;
  /** O tempo está na janela do almoço, com ele ligado. */
  lunch?: boolean;
  /** Toque: marca ou desmarca este tempo neste dia. */
  onToggle: (weekDay: WeekDayNumber, time: TimeSlot) => void;
  /** Toque longo: marca ou desmarca este tempo em todos os dias. */
  onToggleRow: (time: TimeSlot) => void;
};

const ROW_ACTION = [
  { name: 'longpress', label: 'Marcar este horário de segunda a sexta' },
];

/** Ponto de "tem turma aqui" (".cell-dot"), também na legenda. */
export const ClassDot = styled.View`
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background-color: ${({ theme }) => theme.colors.inkMuted};
`;

/** O ponto no canto da célula ocupada, sob o ícone. */
const CornerDot = styled(ClassDot)`
  position: absolute;
  bottom: 6px;
  background-color: ${({ theme }) => theme.status.bad.ink};
`;

/**
 * Célula da tabela (".cell"): 48dp, só a ocupada é preenchida, com o ícone
 * "block" para não depender só da cor. O ponto marca onde as disciplinas
 * escolhidas têm turma: ocupar ali tira a turma da grade.
 */
export const BusyCell = memo(function ({
  weekDay,
  time,
  selected,
  classes = 0,
  lunch = false,
  onToggle,
  onToggleRow,
}: BusyCellProps) {
  const theme = useTheme();
  const day = WEEKDAY_DICTIONARY[weekDay].name;
  const withClasses = classes
    ? `, com turma de ${classes} ${classes === 1 ? 'disciplina escolhida' : 'disciplinas escolhidas'}`
    : '';
  const atLunch = lunch ? ', na janela do almoço' : '';
  return (
    <Cell
      $selected={selected}
      $lunch={lunch}
      onPress={() => onToggle(weekDay, time)}
      onLongPress={() => onToggleRow(time)}
      delayLongPress={500}
      accessibilityRole="togglebutton"
      accessibilityLabel={`${day}, ${time.periodAlias}, ${time.startTimeAlias} às ${time.endTimeAlias}${atLunch}${withClasses}`}
      accessibilityState={{ checked: selected }}
      accessibilityHint="Toque e segure para marcar este horário de segunda a sexta."
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
      ) : classes ? (
        <ClassDot />
      ) : null}
      {selected && classes ? <CornerDot /> : null}
    </Cell>
  );
});
BusyCell.displayName = 'BusyCell';
