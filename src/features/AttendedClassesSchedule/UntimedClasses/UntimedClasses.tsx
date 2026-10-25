import React from 'react';

import { List, ListRow, Section } from '@components/ui';
import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import { hasClassTime, isCanceled } from '../scheduleFormat';

type Props = {
  data: AttendedClassesSchedule[];
  /** Toque numa disciplina: abre "Disciplinas em Curso" nela. */
  onSubjectPress: (item: AttendedClassesSchedule) => void;
};

/**
 * Disciplinas em curso que o Aluno Online não põe na grade de horários
 * (estágio, TCC, EAD): sem elas, a grade vazia parecia um período que nem
 * começou.
 */
export function UntimedClasses({ data, onSubjectPress }: Props) {
  const timed = new Set(
    data.filter(hasClassTime).map(item => item.class?.id ?? item.subject_id),
  );
  const untimed = data.filter(
    item =>
      !hasClassTime(item) &&
      !isCanceled(item) &&
      !timed.has(item.class?.id ?? item.subject_id),
  );
  if (!untimed.length) return null;
  return (
    <Section
      title="Sem horário fixo"
      description="Disciplinas em curso que o Aluno Online não põe na grade de horários, como estágio, TCC ou EAD."
    >
      <List>
        {untimed.map(item => (
          <ListRow
            key={item.class?.id ?? item.subject_id}
            title={item.class?.name ?? item.subject_id}
            code={item.class?.id ?? item.subject_id}
            subtitle={
              item.class?.class ? `Turma ${item.class.class}` : undefined
            }
            chevron
            onPress={() => onSubjectPress(item)}
            accessibilityHint="Abre Disciplinas em Curso"
          />
        ))}
      </List>
    </Section>
  );
}
