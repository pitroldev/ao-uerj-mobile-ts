import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Icon } from '../Icon';
import { Text } from '../Text';

export type WeekDayItem<K extends string | number = number> = {
  key: K;
  /** Abreviação ("Seg"). */
  short: string;
  /** Dia do mês ("12"). Opcional: sem ele a célula mostra só a abreviação. */
  date?: string | number;
  /** Ponto indicando que há aulas no dia. */
  hasEvents?: boolean;
  /** Marca de calendário ao lado do ponto: o dia tem uma avaliação anotada. */
  flagged?: boolean;
  isToday?: boolean;
  /** Ex.: "Terça, 13 de outubro, hoje". Padrão: abreviação + estado. */
  accessibilityLabel?: string;
};

export type WeekDaySelectorProps<K extends string | number = number> = {
  days: WeekDayItem<K>[];
  selected: K;
  onSelect: (key: K) => void;
  style?: StyleProp<ViewStyle>;
};

const Strip = styled.View`
  flex-direction: row;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme }) => theme.colors.ruleStrong};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: 0px;
  overflow: hidden;
`;

const Day = styled.Pressable<{ $selected: boolean; $first: boolean }>`
  flex: 1;
  min-height: 60px;
  align-items: center;
  justify-content: center;
  padding-bottom: 6px;
  border-left-width: ${({ theme, $first }) =>
    $first ? 0 : theme.borders.hairline}px;
  border-left-color: ${({ theme }) => theme.colors.rule};
  background-color: ${({ theme, $selected }) =>
    $selected ? theme.colors.fill : theme.colors.surface};
`;

/** O ponto e a marca, centrados 10dp acima da base da célula. */
const Marks = styled.View`
  position: absolute;
  bottom: 4px;
  height: 12px;
  flex-direction: row;
  align-items: center;
  gap: 2px;
`;

const Dot = styled.View<{ $color: string }>`
  width: 4px;
  height: 4px;
  border-radius: 2px;
  background-color: ${({ $color }) => $color};
`;

/**
 * Seletor de dias (".days"): faixa única com fios de 1px, como o cabeçalho
 * de uma agenda. Hoje em acento; o dia escolhido preenchido de acento; ponto
 * quando há aulas e a marca de calendário quando há avaliação anotada.
 */
export function WeekDaySelector<K extends string | number = number>({
  days,
  selected,
  onSelect,
  style,
}: WeekDaySelectorProps<K>) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Strip
      accessibilityRole="tablist"
      accessibilityLabel="Dias da semana"
      style={style}
    >
      {days.map((day, i) => {
        const isSelected = day.key === selected;
        const fg = isSelected ? c.onFill : day.isToday ? c.accent : c.ink;
        const fgSmall = isSelected
          ? c.onFill
          : day.isToday
            ? c.accent
            : c.inkMuted;
        const label =
          day.accessibilityLabel ??
          [
            day.short + (day.date != null ? ` ${day.date}` : ''),
            day.isToday ? 'hoje' : null,
            day.hasEvents === false ? 'sem aulas' : null,
          ]
            .filter(Boolean)
            .join(', ');
        return (
          <Day
            key={String(day.key)}
            $selected={isSelected}
            $first={i === 0}
            onPress={() => onSelect(day.key)}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: isSelected }}
            style={({ pressed }) =>
              pressed && !isSelected && { backgroundColor: c.surfacePressed }
            }
          >
            {day.date != null ? (
              <>
                <Text variant="caption" color={fgSmall} numberOfLines={1}>
                  {day.short}
                </Text>
                <Text variant="headline" color={fg} tabular numberOfLines={1}>
                  {String(day.date)}
                </Text>
              </>
            ) : (
              <Text variant="headline" color={fg} numberOfLines={1}>
                {day.short}
              </Text>
            )}
            <Marks>
              <Dot
                $color={
                  day.hasEvents
                    ? isSelected
                      ? c.onFill
                      : c.inkSubtle
                    : 'transparent'
                }
              />
              {day.flagged ? (
                <Icon
                  name="event"
                  size={theme.sizes.icon.xxs}
                  color={isSelected ? c.onFill : c.accent}
                />
              ) : null}
            </Marks>
          </Day>
        );
      })}
    </Strip>
  );
}
