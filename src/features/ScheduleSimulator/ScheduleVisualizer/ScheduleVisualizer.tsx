import React from 'react';
import { useWindowDimensions } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { GeneratedClassWithSubject } from '@root/modules/planning/domain/models';
import { Text } from '@components/ui';

import {
  TIME_SLOTS,
  planningDay,
  plural,
  scheduleMeetings,
  shiftOfMinutes,
  slotIndexAtEnd,
  slotIndexAtStart,
  slotRange,
  uniqueAcronyms,
} from '../format';

type Props = {
  data: GeneratedClassWithSubject[];
};

/** Medidas do ".wk": coluna de tempos 34, cabeçalho 26, linha 30, vão 4. */
const TIME_COLUMN = 34;
const HEAD_HEIGHT = 26;
const ROW_HEIGHT = 30;
const BLOCK_INSET = 2;

const Grid = styled.View`
  flex-direction: row;
  gap: 4px;
  margin-top: 14px;
`;

const TimeColumn = styled.View`
  width: ${TIME_COLUMN}px;
`;

/**
 * ".wk-band": no escuro, a linha dos dias sobe um degrau, como o cabeçalho
 * das tabelas (faixa `surface` um pouco maior que a grade).
 */
const HeadBand = styled.View`
  position: absolute;
  top: -4px;
  left: -10px;
  right: -10px;
  background-color: ${({ theme }) => theme.colors.surface};
`;

const Spacer = styled.View``;

const DayColumn = styled.View`
  flex: 1;
  min-width: 0px;
`;

const Rule = styled.View`
  border-bottom-width: ${({ theme }) => theme.borders.hairline}px;
  border-bottom-color: ${({ theme }) => theme.colors.rule};
`;

const TimeCell = styled(Rule)`
  justify-content: center;
`;

const DayHead = styled(Rule)`
  justify-content: flex-end;
  padding-bottom: 6px;
`;

/** Bloco da aula (".wk-b"): pastel do turno, fio e canto cortado. */
const Block = styled.View<{ $bg: string; $line: string }>`
  position: absolute;
  left: 0px;
  right: 0px;
  padding: 5px 6px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ $line }) => $line};
  border-radius: ${({ theme }) => theme.radii.md}px;
  border-top-right-radius: 0px;
  background-color: ${({ $bg }) => $bg};
  overflow: hidden;
`;

const Key = styled.View`
  margin-top: 14px;
  gap: 6px;
`;

const KeyRow = styled.View`
  flex-direction: row;
  align-items: baseline;
`;

const KeyAcronym = styled(Text)`
  min-width: 38px;
  padding-right: 6px;
`;

const KeyLabel = styled(Text)`
  flex: 1;
`;

const byName = (a: GeneratedClassWithSubject, b: GeneratedClassWithSubject) =>
  a.name.localeCompare(b.name);

/**
 * Aba "Horários" da grade gerada: semana em colunas (segunda a sexta, e
 * sábado/domingo quando houver aula), só os tempos usados, blocos com a
 * sigla da disciplina na cor do turno e a legenda das siglas abaixo.
 */
export const ScheduleVisualizer = React.memo(function ScheduleVisualizer({
  data,
}: Props) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();

  if (!data || data.length === 0) {
    return null;
  }

  // as alturas acompanham o tamanho de fonte do sistema
  const scale = Math.min(Math.max(fontScale || 1, 1), 2);
  const headHeight = Math.round(HEAD_HEIGHT * scale);
  const rowHeight = Math.round(ROW_HEIGHT * scale);

  const items = [...data].sort(byName);
  const acronyms = uniqueAcronyms(
    items.map(item => ({ key: item.subject_id, name: item.name })),
  );

  const meetings = items.flatMap(item =>
    item.schedules.map(schedule => {
      const first = slotIndexAtStart(schedule.start_time_in_minutes);
      return {
        item,
        day: schedule.week_day,
        first,
        last: Math.max(first, slotIndexAtEnd(schedule.end_time_in_minutes)),
      };
    }),
  );

  if (!meetings.length) {
    return null;
  }

  const lo = Math.min(...meetings.map(m => m.first));
  const hi = Math.max(...meetings.map(m => m.last));
  const rows = TIME_SLOTS.slice(lo, hi + 1);
  const days = [0, 1, 2, 3, 4];
  [5, 6].forEach(day => {
    if (meetings.some(m => m.day === day)) days.push(day);
  });

  const label = `Grade semanal com ${plural(
    items.length,
    'disciplina',
    'disciplinas',
  )}. ${items
    .map(
      item =>
        `${item.name}, turma ${item.id}: ${scheduleMeetings(item.schedules)}`,
    )
    .join('. ')}`;

  return (
    <>
      <Grid accessible accessibilityRole="image" accessibilityLabel={label}>
        {theme.name === 'dark' ? (
          <HeadBand style={{ height: headHeight + 4 }} />
        ) : null}
        <TimeColumn>
          <Spacer style={{ height: headHeight }} />
          {rows.map(slot => (
            <TimeCell key={slot.periodAlias} style={{ height: rowHeight }}>
              <Text variant="caption" weight="regular" tone="muted" tabular>
                {slot.periodAlias}
              </Text>
            </TimeCell>
          ))}
        </TimeColumn>
        {days.map(day => (
          <DayColumn key={day}>
            <DayHead style={{ height: headHeight }}>
              <Text
                variant="caption"
                weight="semibold"
                tone="muted"
                align="center"
                numberOfLines={1}
              >
                {planningDay(day)?.shortName}
              </Text>
            </DayHead>
            {rows.map(slot => (
              <Rule key={slot.periodAlias} style={{ height: rowHeight }} />
            ))}
            {meetings
              .filter(m => m.day === day)
              .map(m => {
                const tone =
                  theme.shift[
                    shiftOfMinutes(TIME_SLOTS[m.first].start_time_in_minutes)
                  ];
                return (
                  <Block
                    key={`${m.item.subject_id}-${m.item.id}-${m.first}`}
                    $bg={tone.bg}
                    $line={tone.line}
                    style={{
                      top:
                        headHeight + (m.first - lo) * rowHeight + BLOCK_INSET,
                      height:
                        (m.last - m.first + 1) * rowHeight - 2 * BLOCK_INSET,
                    }}
                  >
                    <Text
                      variant="caption"
                      weight="bold"
                      color={tone.ink}
                      numberOfLines={1}
                    >
                      {acronyms.get(m.item.subject_id)}
                    </Text>
                    <Text
                      variant="caption"
                      weight="regular"
                      tone="muted"
                      numberOfLines={1}
                    >
                      {slotRange(
                        TIME_SLOTS[m.first].periodAlias,
                        TIME_SLOTS[m.last].periodAlias,
                      )}
                    </Text>
                  </Block>
                );
              })}
          </DayColumn>
        ))}
      </Grid>
      <Key>
        {items.map(item => (
          <KeyRow key={`${item.subject_id}-${item.id}`}>
            <KeyAcronym variant="meta" weight="bold">
              {acronyms.get(item.subject_id)}
            </KeyAcronym>
            <KeyLabel variant="meta" tone="muted">
              {item.name} · Turma {item.id}
            </KeyLabel>
          </KeyRow>
        ))}
      </Key>
    </>
  );
});
