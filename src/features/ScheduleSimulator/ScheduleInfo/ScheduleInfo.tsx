import React from 'react';

import { GeneratedClassWithSubject } from '@root/modules/planning/domain/models';
import { List, ListRow, SHIFT_LABEL, StatusLabel, Text } from '@components/ui';

import { scheduleMeetings, shiftOfMinutes } from '../format';

type Props = {
  schedule: GeneratedClassWithSubject[];
};

const firstMeeting = (item: GeneratedClassWithSubject) =>
  [...item.schedules].sort(
    (a, b) =>
      a.week_day - b.week_day ||
      a.start_time_in_minutes - b.start_time_in_minutes,
  )[0];

/**
 * Aba "Informações" da grade gerada: uma linha por disciplina com turma,
 * docentes, turno e encontros ("● Manhã  Seg e Qua · M3–M4 · 8:50–10:30").
 */
export const ScheduleInfo = ({ schedule }: Props) => {
  const items = [...schedule].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <List accessibilityLabel="Disciplinas da grade">
      {items.map(item => {
        const first = firstMeeting(item);
        const shift = first
          ? shiftOfMinutes(first.start_time_in_minutes)
          : null;
        const meetings = scheduleMeetings(item.schedules);
        const teachers = [...item.teachers].sort().join(', ');
        return (
          <ListRow
            key={`${item.subject_id}-${item.id}`}
            title={item.name}
            code={item.subject.id}
            subtitle={`Turma ${item.id}`}
            meta={teachers || undefined}
            facts={
              <>
                {shift ? (
                  <StatusLabel tone={shift} label={SHIFT_LABEL[shift]} />
                ) : null}
                {meetings ? (
                  <Text variant="meta" tone="muted">
                    {meetings}
                  </Text>
                ) : null}
              </>
            }
          />
        );
      })}
    </List>
  );
};
