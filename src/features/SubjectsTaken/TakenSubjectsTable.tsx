import React from 'react';
import styled from 'styled-components/native';

import {
  GradeCell,
  HEALTH_LABEL,
  StatusLabel,
  Table,
  TableRow,
  Text,
  formatGrade,
  healthTone,
  type TableColumn,
  type UiTone,
} from '@components/ui';
import type { SubjectsTaken } from '@root/modules/academics/domain/models';
import { numberToColor } from '@utils/numberToColor';
import {
  SUBJECT_STATUS,
  SUBJECT_TYPE,
} from '@utils/constants/subjectDictionary';
import {
  CountRow,
  joinMeta,
  joinSpoken,
  plural,
} from '@features/SubjectsToTake';

/** Situação → tom do ponto (aprovado verde, reprovado vermelho, em curso acento). */
const STATUS_TONE: Record<SubjectsTaken['status'], UiTone> = {
  APPROVED: 'good',
  FAILED_BY_GRADE: 'bad',
  FAILED_BY_ATTENDANCE: 'bad',
  CANCELED: 'neutral',
  EXEMPT: 'neutral',
  IN_PROGRESS: 'accent',
};

/** Colunas do histórico (".gt.hist"): frequência 52 e nota 58. */
const COLUMNS: TableColumn[] = [
  { key: 'subject', label: 'Disciplina' },
  { key: 'frequency', label: 'Freq.', width: 52, align: 'center' },
  { key: 'grade', label: 'Nota', width: 58, align: 'right' },
];

const HistoryTable = styled(Table)`
  margin-top: 14px;
`;

const SubjectCell = styled.View`
  align-self: stretch;
`;

const Meta = styled(Text)`
  margin-top: ${({ theme }) => theme.spacing.xxs}px;
`;

/** Situação e carga (".gt-facts"): 2/10 de espaço, 4 acima. */
const Facts = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 10px;
  row-gap: ${({ theme }) => theme.spacing.xxs}px;
  margin-top: ${({ theme }) => theme.spacing.xs}px;
`;

/** Frequência centrada na altura da célula de nota (".gt-freq"). */
const FrequencyBox = styled.View`
  min-height: ${({ theme }) => theme.sizes.gradeCell.height}px;
  justify-content: center;
`;

function statusLabel(status: string) {
  return SUBJECT_STATUS[status as keyof typeof SUBJECT_STATUS] ?? status;
}

function typeLabel(type: string) {
  return SUBJECT_TYPE[type as keyof typeof SUBJECT_TYPE] ?? type;
}

function creditsLabel(credits: number | null) {
  return credits !== null ? plural(credits, 'crédito', 'créditos') : null;
}

/** Créditos e carga de uma disciplina ("4 créditos · 60 h"). */
function loadText({ credits, workload }: SubjectsTaken) {
  return joinMeta([creditsLabel(credits), workload ? `${workload} h` : null]);
}

function rowAccessibilityLabel(subject: SubjectsTaken) {
  const { name, id, type, status, frequency, grade, credits, workload } =
    subject;
  const gradeText =
    grade !== null && Number.isFinite(grade)
      ? `Nota ${formatGrade(grade)}, ${
          HEALTH_LABEL[healthTone(numberToColor(grade, 10))]
        }`
      : 'Sem nota';
  return joinSpoken([
    name,
    id,
    typeLabel(type),
    statusLabel(status),
    frequency !== null
      ? `Frequência ${frequency}%`
      : 'Frequência não informada',
    gradeText,
    creditsLabel(credits),
    workload ? `${workload} horas` : null,
  ]);
}

/** "5 disciplinas" à esquerda; créditos e horas somados à direita. */
export function TakenSubjectsSummary({
  subjects,
}: {
  subjects: readonly SubjectsTaken[];
}) {
  const credits = subjects.reduce((sum, s) => sum + (s.credits ?? 0), 0);
  const hours = subjects.reduce((sum, s) => sum + (s.workload ?? 0), 0);
  return (
    <CountRow>
      <Text variant="meta" weight="semibold">
        {plural(subjects.length, 'disciplina', 'disciplinas')}
      </Text>
      <Text variant="meta" tone="muted">
        {joinMeta([
          plural(credits, 'crédito', 'créditos'),
          plural(hours, 'hora', 'horas'),
        ])}
      </Text>
    </CountRow>
  );
}

type TakenSubjectsTableProps = {
  period: string;
  subjects: readonly SubjectsTaken[];
  onSubjectPress: (subject: SubjectsTaken) => void;
};

/**
 * Histórico do período como tabela de fios: disciplina (nome; código e tipo;
 * situação com ponto, créditos e horas), frequência e nota tingida.
 * Cada linha abre a disciplina na Pesquisa de Disciplinas.
 */
export function TakenSubjectsTable({
  period,
  subjects,
  onSubjectPress,
}: TakenSubjectsTableProps) {
  return (
    <HistoryTable
      columns={COLUMNS}
      verticalAlign="top"
      rowPadding={12}
      accessibilityLabel={`Disciplinas cursadas em ${period}`}
    >
      {subjects.map((subject, index) => {
        const { name, id, type, status, frequency, grade } = subject;
        const load = loadText(subject);
        return (
          <TableRow
            key={`${id}-${index}`}
            onPress={() => onSubjectPress(subject)}
            accessibilityLabel={rowAccessibilityLabel(subject)}
          >
            <SubjectCell>
              <Text variant="body" weight="semibold">
                {name}
              </Text>
              <Meta variant="meta" tone="muted">
                {joinMeta([id, typeLabel(type)])}
              </Meta>
              <Facts>
                <StatusLabel
                  tone={STATUS_TONE[status] ?? 'neutral'}
                  label={statusLabel(status)}
                />
                {load ? (
                  <Text variant="meta" tone="muted">
                    {load}
                  </Text>
                ) : null}
              </Facts>
            </SubjectCell>
            <FrequencyBox>
              <Text tabular>{frequency !== null ? `${frequency}%` : '–'}</Text>
            </FrequencyBox>
            <GradeCell value={grade} />
          </TableRow>
        );
      })}
    </HistoryTable>
  );
}
