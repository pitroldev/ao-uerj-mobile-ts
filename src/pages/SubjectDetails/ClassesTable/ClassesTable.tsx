import React from 'react';

import { StatusLabel, Text } from '@components/ui';
import type { SubjectClassesSchedule } from '@root/modules/academics/domain/models';

import { groupSchedule, vacancyInfo, type VacancyInfo } from '../subjectFormat';
import {
  Body,
  ClassBlock,
  Details,
  HeaderCell,
  HeaderNumber,
  HeaderRow,
  NumberCell,
  Teachers,
  TeachersRow,
  VacancyBar,
  VacancyCell,
  VacancyRow,
  VacancyTop,
} from './ClassesTable.styles';

type Props = {
  classes: SubjectClassesSchedule[];
};

/** Célula de vagas: "38/40", ponto + rótulo e a barra fina de 4dp. */
function Vacancy({ info }: { info: VacancyInfo }) {
  return (
    <VacancyCell>
      <VacancyTop>
        <Text variant="body" weight="semibold" tabular>
          {info.text}
        </Text>
        <StatusLabel tone={info.tone} label={info.label} />
      </VacancyTop>
      <VacancyBar
        thin
        value={info.fill}
        tone={info.tone === 'neutral' ? 'accent' : info.tone}
        accessibilityLabel={info.accessibilityLabel}
      />
    </VacancyCell>
  );
}

function ClassRow({ item }: { item: SubjectClassesSchedule }) {
  const uerj = item.vacancies?.uerj;
  const requested = vacancyInfo(
    'Solicitadas',
    uerj?.requestedTaken,
    uerj?.requestedAvailable,
  );
  const occupied = vacancyInfo('Ocupadas', uerj?.taken, uerj?.available);
  const teachers = item.teachers?.filter(Boolean) ?? [];
  const schedule = groupSchedule(item.schedule);
  const number = item.classNumber ?? '–';

  const summary = [
    `Turma ${number}`,
    requested.accessibilityLabel,
    occupied.accessibilityLabel,
    teachers.length
      ? `${teachers.length > 1 ? 'Docentes' : 'Docente'}: ${teachers.join(
          ', ',
        )}`
      : '',
    item.hasPreference ? 'Preferencial' : '',
    ...schedule.map(group => group.accessibilityLabel),
  ]
    .filter(Boolean)
    .join('. ');

  const hasTeacherLine = teachers.length > 0 || Boolean(item.hasPreference);

  return (
    <ClassBlock accessible accessibilityLabel={summary}>
      <NumberCell>
        <Text variant="headline" tabular>
          {number}
        </Text>
      </NumberCell>
      <Body>
        <VacancyRow>
          <Vacancy info={requested} />
          <Vacancy info={occupied} />
        </VacancyRow>
        <Details>
          {hasTeacherLine ? (
            <TeachersRow>
              {teachers.length ? (
                <Teachers>{teachers.join(', ')}</Teachers>
              ) : null}
              {item.hasPreference ? (
                <StatusLabel tone="accent" icon="star" label="Preferencial" />
              ) : null}
            </TeachersRow>
          ) : null}
          {schedule.map(group => (
            <Text key={group.text} variant="meta" tone="muted">
              {group.text}
            </Text>
          ))}
        </Details>
      </Body>
    </ClassBlock>
  );
}

/**
 * Turmas da disciplina como tabela compacta de fios (".tt"): número da turma,
 * vagas Solicitadas e Ocupadas (x/y, saúde com ponto + rótulo e barra fina) e,
 * na segunda linha, docentes, Preferencial e horários agrupados.
 */
const ClassesTable = ({ classes }: Props) => (
  <>
    <HeaderRow
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <HeaderNumber>
        <Text variant="caption" tone="muted">
          Turma
        </Text>
      </HeaderNumber>
      <HeaderCell>
        <Text variant="caption" tone="muted">
          Solicitadas
        </Text>
      </HeaderCell>
      <HeaderCell $last>
        <Text variant="caption" tone="muted">
          Ocupadas
        </Text>
      </HeaderCell>
    </HeaderRow>
    {classes.map((item, index) => (
      <ClassRow key={`${item.classNumber ?? 'turma'}-${index}`} item={item} />
    ))}
  </>
);

export default ClassesTable;
