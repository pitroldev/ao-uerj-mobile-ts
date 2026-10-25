import React, { useMemo, useState } from 'react';
import styled, { useTheme } from 'styled-components/native';

import {
  Button,
  Card,
  Icon,
  List,
  ListRow,
  Section,
  Tag,
  Text,
} from '@components/ui';
import type {
  AttendedClassesSchedule,
  ClassGrade,
} from '@root/modules/academics/domain/models';
import { fromIsoDate } from '@root/modules/attendance/domain/attendance';
import {
  isExam,
  upcomingEvaluations,
  type Evaluation,
} from '@root/modules/evaluations/domain/evaluations';
import {
  countdown,
  daysUntil,
  evaluationTitle,
  longDate,
  TYPE_LABEL,
  whenText,
} from '@root/modules/evaluations/presentation/evaluationText';
import {
  evaluationRoom,
  gradesBySubject,
} from '@root/modules/evaluations/presentation/scheduleLookup';
import { WEEKDAY_SHORT } from '@features/AttendedClassesSchedule/scheduleFormat';

type Props = {
  evaluations: readonly Evaluation[];
  schedule: readonly AttendedClassesSchedule[];
  grades: readonly ClassGrade[];
  now: Date;
  onAdd: () => void;
  onPress: (evaluation: Evaluation) => void;
};

/** Quantas aparecem antes de "Ver todas". */
const SHOWN = 3;

/** O dia da avaliação, como a data de uma agenda: hoje preenchido. */
const Tile = styled.View<{ $today: boolean }>`
  width: 46px;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  padding: 4px 0px;
  border-radius: ${({ theme }) => theme.radii.md}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme, $today }) =>
    $today ? theme.colors.fill : theme.colors.accentSoft};
`;

const Empty = styled.View`
  flex-direction: row;
  gap: 12px;
`;

const EmptyText = styled.View`
  flex: 1;
  gap: 2px;
`;

function DateTile({ date, today }: { date: string; today: boolean }) {
  const theme = useTheme();
  const color = today ? theme.colors.onFill : theme.colors.accent;
  const day = fromIsoDate(date);
  return (
    <Tile $today={today}>
      <Text variant="caption" color={color}>
        {WEEKDAY_SHORT[day.getDay()].toUpperCase()}
      </Text>
      <Text variant="headline" color={color} tabular>
        {day.getDate()}
      </Text>
    </Tile>
  );
}

/**
 * "Próximas avaliações" no Início, logo abaixo da próxima aula: as provas e
 * os trabalhos anotados, do mais perto para o mais longe, com a contagem e a
 * observação. Some a prova cuja nota saiu, a que já começou e a marcada
 * como feita no aviso.
 */
export function UpcomingEvaluations({
  evaluations,
  schedule,
  grades,
  now,
  onAdd,
  onPress,
}: Props) {
  const theme = useTheme();
  const [all, setAll] = useState(false);
  const list = useMemo(
    () => upcomingEvaluations(evaluations, now, gradesBySubject(grades)),
    [evaluations, now, grades],
  );
  const shown = all ? list : list.slice(0, SHOWN);

  return (
    <Section
      title="Próximas avaliações"
      action={
        <Button
          variant="text"
          size="sm"
          icon="add"
          label="Adicionar"
          accessibilityLabel="Anotar uma prova ou trabalho"
          onPress={onAdd}
        />
      }
    >
      {list.length ? (
        <>
          <List>
            {shown.map(item => {
              const days = daysUntil(item.date, now);
              const room = evaluationRoom(schedule, item);
              const when = [whenText(item), room].filter(Boolean).join(' · ');
              const left = countdown(item.date, now);
              return (
                <ListRow
                  key={item.id}
                  leading={<DateTile date={item.date} today={days === 0} />}
                  leadingAlign="start"
                  title={item.subjectName}
                  titleLines={1}
                  facts={
                    <>
                      <Tag
                        label={TYPE_LABEL[item.type]}
                        tone={isExam(item.type) ? 'info' : 'neutral'}
                      />
                      <Text variant="meta" tone="muted" tabular>
                        {when}
                      </Text>
                    </>
                  }
                  trailing={
                    <Text
                      variant="meta"
                      weight="semibold"
                      color={
                        days === 0
                          ? theme.colors.accent
                          : days === 1
                            ? theme.colors.ink
                            : theme.colors.inkMuted
                      }
                    >
                      {left}
                    </Text>
                  }
                  chevron
                  onPress={() => onPress(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${evaluationTitle(item)}, ${longDate(
                    item.date,
                  )}, ${when}. ${left}.${item.note ? ` ${item.note}` : ''}`}
                  accessibilityHint="Abre para editar"
                >
                  {item.note ? (
                    <Text variant="meta" tone="muted" numberOfLines={2}>
                      {item.note}
                    </Text>
                  ) : null}
                </ListRow>
              );
            })}
          </List>
          {list.length > SHOWN ? (
            <Button
              variant="link"
              label={all ? 'Mostrar menos' : `Ver todas (${list.length})`}
              onPress={() => setAll(open => !open)}
            />
          ) : null}
        </>
      ) : (
        <Card dashed>
          <Empty>
            <Icon
              name="event_upcoming"
              size={theme.sizes.icon.xl}
              color={theme.colors.inkMuted}
            />
            <EmptyText>
              <Text weight="semibold">Nenhuma avaliação anotada</Text>
              <Text variant="meta" tone="muted">
                Anote a data de uma prova ou trabalho para ver aqui e receber
                lembrete na véspera e no dia.
              </Text>
            </EmptyText>
          </Empty>
        </Card>
      )}
    </Section>
  );
}
