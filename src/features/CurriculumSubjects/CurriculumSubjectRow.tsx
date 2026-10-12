import React, { memo } from 'react';

import { ListRow, StatusLabel, Tag } from '@components/ui';
import type { CurriculumSubject } from '@root/modules/academics/domain/models';
import { SUBJECT_TYPE } from '@utils/constants/subjectDictionary';
import {
  SUBJECT_LIST_COPY,
  joinMeta,
  joinSpoken,
  plural,
} from '@features/SubjectsToTake';

/** Tipos do filtro do currículo, na ordem dos chips. */
export const CURRICULUM_TYPE_FILTERS: ReadonlyArray<{
  value: '' | CurriculumSubject['type'];
  label: string;
}> = [
  { value: '', label: 'Todas' },
  { value: 'MANDATORY', label: 'Obrigatórias' },
  { value: 'RESTRICTED', label: 'Eletivas Restritas' },
  { value: 'DEFINED', label: 'Eletivas Definidas' },
  { value: 'UNIVERSAL', label: 'Universais' },
];

function details({ period, branch, credits, workload }: CurriculumSubject) {
  return {
    period: period ? `${period}º período` : null,
    branch: branch ? `Ramificação ${branch}` : null,
    credits: credits ? plural(credits, 'crédito', 'créditos') : null,
    workload: workload !== null ? `${workload} horas` : null,
  };
}

export type CurriculumSubjectRowProps = {
  subject: CurriculumSubject;
  onPress: (subject: CurriculumSubject) => void;
};

/**
 * Disciplina do currículo: nome; código e tipo; período, ramificação,
 * créditos e horas; "Atendida" com ponto; "Trava de N créditos" quando há
 * mínimo de créditos. Toque abre a disciplina.
 */
export const CurriculumSubjectRow = memo(function ({
  subject,
  onPress,
}: CurriculumSubjectRowProps) {
  const { name, id, type, alreadyTaken, minimum_credits } = subject;
  const typeLabel = SUBJECT_TYPE[type] || type;
  const info = details(subject);
  const lock = minimum_credits
    ? `Trava de ${minimum_credits} créditos`
    : undefined;
  const meta = joinMeta([
    info.period,
    info.branch,
    info.credits,
    info.workload,
  ]);

  return (
    <ListRow
      title={name}
      code={id}
      subtitle={typeLabel}
      meta={meta || undefined}
      facts={
        alreadyTaken ? <StatusLabel tone="good" label="Atendida" /> : undefined
      }
      chevron
      divider={false}
      onPress={() => onPress(subject)}
      accessibilityLabel={joinSpoken([
        name,
        id,
        typeLabel,
        info.period,
        info.branch,
        info.credits,
        info.workload,
        alreadyTaken ? 'Atendida' : null,
        lock,
      ])}
      accessibilityHint={SUBJECT_LIST_COPY.openHint}
    >
      {lock ? <Tag tone="warn" icon="lock" label={lock} /> : null}
    </ListRow>
  );
});
CurriculumSubjectRow.displayName = 'CurriculumSubjectRow';

export default CurriculumSubjectRow;
