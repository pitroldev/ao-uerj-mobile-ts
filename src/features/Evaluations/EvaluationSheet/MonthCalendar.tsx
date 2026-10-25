import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { IconButton, Text } from '@components/ui';
import {
  fromIsoDate,
  toIsoDate,
} from '@root/modules/attendance/domain/attendance';
import { dateLabel } from '@features/AttendedClassesSchedule/scheduleFormat';

type Props = {
  /** Dia escolhido, "AAAA-MM-DD". */
  value: string | null;
  /** Primeiro dia que dá para escolher (hoje). */
  min: string;
  /** Último dia que dá para escolher. */
  max: string;
  /** Dias com aula da disciplina: ganham um ponto. */
  isClassDay: (date: string) => boolean;
  onChange: (date: string) => void;
};

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEKDAYS = [
  ['D', 'Domingo'],
  ['S', 'Segunda'],
  ['T', 'Terça'],
  ['Q', 'Quarta'],
  ['Q', 'Quinta'],
  ['S', 'Sexta'],
  ['S', 'Sábado'],
] as const;

type Month = { year: number; month: number };

function monthOf(date: string): Month {
  const day = fromIsoDate(date);
  return { year: day.getFullYear(), month: day.getMonth() };
}

function shift({ year, month }: Month, delta: number): Month {
  const day = new Date(year, month + delta, 1);
  return { year: day.getFullYear(), month: day.getMonth() };
}

function index({ year, month }: Month): number {
  return year * 12 + month;
}

/** As semanas do mês, de domingo a sábado; `null` fora do mês. */
function weeksOf({ year, month }: Month): (string | null)[][] {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: first }, () => null),
    ...Array.from({ length: days }, (_, i) =>
      toIsoDate(new Date(year, month, i + 1)),
    ),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const Header = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin: 0px -12px 4px 0px;
`;

const Arrows = styled.View`
  flex-direction: row;
`;

const Week = styled.View`
  flex-direction: row;
`;

const Head = styled.View`
  flex: 1;
  align-items: center;
  padding: 6px 0px;
`;

/** Célula de 44dp; a seleção é o quadrado de canto cortado do sistema. */
const Day = styled.Pressable<{ $selected: boolean }>`
  flex: 1;
  height: 44px;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radii.md}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme, $selected }) =>
    $selected ? theme.colors.fill : 'transparent'};
`;

const Blank = styled.View`
  flex: 1;
  height: 44px;
`;

const Dot = styled.View<{ $color: string }>`
  position: absolute;
  bottom: 6px;
  width: 4px;
  height: 4px;
  border-radius: 2px;
  background-color: ${({ $color }) => $color};
`;

/**
 * Calendário de um mês dentro da folha ("Outra data"), sem outro modal por
 * cima: setas para os meses, hoje em acento, o dia escolhido preenchido e um
 * ponto nos dias de aula da disciplina. Dias antes de `min` ou depois de
 * `max` não se escolhem.
 */
export function MonthCalendar({
  value,
  min,
  max,
  isClassDay,
  onChange,
}: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const [shown, setShown] = useState<Month>(() => monthOf(value ?? min));
  const first = monthOf(min);
  const last = monthOf(max);
  const canGoBack = index(shown) > index(first);
  const canGoForward = index(shown) < index(last);
  const title = `${MONTHS[shown.month]} de ${shown.year}`;

  return (
    <>
      <Header>
        <Text
          weight="semibold"
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
        >
          {title}
        </Text>
        <Arrows>
          <IconButton
            icon="chevron_left"
            accessibilityLabel="Mês anterior"
            disabled={!canGoBack}
            onPress={() => setShown(month => shift(month, -1))}
          />
          <IconButton
            icon="chevron_right"
            accessibilityLabel="Próximo mês"
            disabled={!canGoForward}
            onPress={() => setShown(month => shift(month, 1))}
          />
        </Arrows>
      </Header>
      <Week importantForAccessibility="no-hide-descendants">
        {WEEKDAYS.map(([short, name]) => (
          <Head key={name} accessibilityElementsHidden>
            <Text variant="caption" tone="muted">
              {short}
            </Text>
          </Head>
        ))}
      </Week>
      {weeksOf(shown).map(week => (
        <Week key={week.find(Boolean) ?? ''}>
          {week.map((date, i) => {
            if (!date) return <Blank key={`blank-${i}`} />;
            const selected = date === value;
            const disabled = date < min || date > max;
            const today = date === min;
            const classDay = isClassDay(date);
            let color = c.ink;
            if (selected) color = c.onFill;
            else if (today) color = c.accent;
            else if (disabled) color = c.inkMuted;
            const label = [
              dateLabel(fromIsoDate(date)),
              today ? 'hoje' : null,
              classDay ? 'dia de aula' : null,
            ]
              .filter(Boolean)
              .join(', ');
            return (
              <Day
                key={date}
                $selected={selected}
                disabled={disabled}
                onPress={() => onChange(date)}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected, disabled }}
                style={({ pressed }) => [
                  disabled && styles.disabled,
                  pressed && !selected && { backgroundColor: c.surfacePressed },
                ]}
              >
                <Text
                  weight={selected || today ? 'semibold' : 'regular'}
                  color={color}
                  tabular
                >
                  {fromIsoDate(date).getDate()}
                </Text>
                {classDay && !disabled ? (
                  <Dot $color={selected ? c.onFill : c.inkSubtle} />
                ) : null}
              </Day>
            );
          })}
        </Week>
      ))}
    </>
  );
}

const styles = StyleSheet.create({ disabled: { opacity: 0.5 } });
