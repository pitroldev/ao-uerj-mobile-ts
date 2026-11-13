import React from 'react';
import styled from 'styled-components/native';

import { BottomSheet, IconButton, List, ListRow, Notice } from '@components/ui';
import type { CurriculumSubject } from '@root/modules/academics/domain/models';
import type { SubjectAvailability } from '@root/modules/planning/domain/availability';

import { plural } from '../../format';
import { SubjectStatus, statusText } from './SubjectStatus';

const Retry = styled(Notice)`
  margin-bottom: 12px;
`;

type Props = {
  visible: boolean;
  onClose: () => void;
  subjects: readonly CurriculumSubject[];
  availability: ReadonlyMap<string, SubjectAvailability>;
  /** Quantas leituras de turmas falharam. */
  failed: number;
  onRetry: () => void;
  onRemove: (subject: CurriculumSubject) => void;
};

/**
 * As disciplinas escolhidas, do curso e universais, num lugar só: o que o
 * portal disse de cada uma e o X para tirar.
 */
export function ChosenSheet({
  visible,
  onClose,
  subjects,
  availability,
  failed,
  onRetry,
  onRemove,
}: Props) {
  const credits = subjects.reduce(
    (sum, subject) => sum + (subject.credits ?? 0),
    0,
  );
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Disciplinas escolhidas"
      meta={credits ? plural(credits, 'crédito', 'créditos') : undefined}
    >
      {failed ? (
        <Retry
          tone="warn"
          icon="sync_problem"
          text={`Não deu para buscar as turmas de ${plural(failed, 'disciplina', 'disciplinas')}.`}
          onRetry={onRetry}
        />
      ) : null}
      <List accessibilityLabel="Disciplinas escolhidas">
        {subjects.map(subject => {
          const state = availability.get(subject.id);
          return (
            <ListRow
              key={subject.id}
              title={subject.name}
              code={subject.id}
              facts={state ? <SubjectStatus state={state} /> : undefined}
              accessibilityLabel={[subject.name, subject.id, statusText(state)]
                .filter(Boolean)
                .join(', ')}
              trailing={
                <IconButton
                  icon="close"
                  accessibilityLabel={`Tirar ${subject.name}`}
                  onPress={() => onRemove(subject)}
                />
              }
            />
          );
        })}
      </List>
    </BottomSheet>
  );
}
