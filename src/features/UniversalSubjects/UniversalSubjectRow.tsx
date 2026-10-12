import React, { memo } from 'react';

import { ListRow } from '@components/ui';
import type { UniversalSubject } from '@root/modules/academics/domain/models';
import {
  SUBJECT_LIST_COPY,
  joinMeta,
  joinSpoken,
  plural,
} from '@features/SubjectsToTake';

import { departmentOf } from './departments';

export type UniversalSubjectRowProps = {
  subject: UniversalSubject;
  onPress: (subject: UniversalSubject) => void;
};

/**
 * Disciplina universal: nome; código, créditos e horas; unidade que a
 * oferece. Toque abre a disciplina.
 */
export const UniversalSubjectRow = memo(function ({
  subject,
  onPress,
}: UniversalSubjectRowProps) {
  const { name, id, credits, workload } = subject;
  const creditsText = credits ? plural(credits, 'crédito', 'créditos') : null;
  const workloadText = workload !== null ? `${workload} horas` : null;
  const unit = departmentOf(id).unitName;

  return (
    <ListRow
      title={name}
      code={id}
      subtitle={joinMeta([creditsText, workloadText]) || undefined}
      meta={unit}
      chevron
      divider={false}
      onPress={() => onPress(subject)}
      accessibilityLabel={joinSpoken([
        name,
        id,
        creditsText,
        workloadText,
        unit,
      ])}
      accessibilityHint={SUBJECT_LIST_COPY.openHint}
    />
  );
});
UniversalSubjectRow.displayName = 'UniversalSubjectRow';

export default UniversalSubjectRow;
