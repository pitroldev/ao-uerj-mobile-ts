import React from 'react';
import styled from 'styled-components/native';

import { List, ListRow, ProgressBar, Tag, Text } from '@components/ui';
import type { SubjectType } from '@root/modules/academics/domain/rules/progress';

/** Nomes no plural, como o protótipo mostra cada grupo do currículo. */
export const TYPE_PLURAL: Record<SubjectType, string> = {
  MANDATORY: 'Obrigatórias',
  RESTRICTED: 'Eletivas Restritas',
  DEFINED: 'Eletivas Definidas',
  UNIVERSAL: 'Universais',
};

export type PathData = {
  order: SubjectType[];
  totals: Record<SubjectType, number>;
  completed: Record<SubjectType, number>;
  remaining: Record<SubjectType, number>;
  requiredCredits: Record<SubjectType, number | null>;
  percent: Record<SubjectType, number>;
  totalCredits: Record<SubjectType, number>;
  completedCredits: Record<SubjectType, number>;
};

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Meta de um grupo: Obrigatórias por contagem (exige o currículo carregado e
 * com disciplinas); eletivas por créditos configurados.
 */
export function pathGoal(
  type: SubjectType,
  data: PathData,
  curriculumAvailable: boolean,
) {
  const mandatory = type === 'MANDATORY';
  const required = data.requiredCredits[type];
  const hasRequired = Boolean(required && required > 0);
  const total = data.totals[type];
  const tracked = curriculumAvailable && (mandatory ? total > 0 : hasRequired);
  return { mandatory, hasRequired, tracked };
}

const Top = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const Name = styled(Text)`
  flex-shrink: 1;
`;

/** ".path .bar{margin:8px 0 4px}" (a coluna da linha já tem 2 de espaço). */
const BarSlot = styled.View`
  margin-top: 6px;
  margin-bottom: 2px;
`;

type RowProps = {
  type: SubjectType;
  data: PathData;
  curriculumAvailable: boolean;
  divider?: boolean;
};

/**
 * Linha de um grupo: nome e percentual, barra e "28 de 36 disciplinas ·
 * faltam 8"; sem meta, a etiqueta "Sem meta" e o que já foi concluído.
 */
function PathRow({ type, data, curriculumAvailable, divider }: RowProps) {
  const name = TYPE_PLURAL[type];
  const { mandatory, hasRequired, tracked } = pathGoal(
    type,
    data,
    curriculumAvailable,
  );

  if (tracked) {
    const done = mandatory ? data.completed[type] : data.completedCredits[type];
    const target = mandatory
      ? data.totals[type]
      : (data.requiredCredits[type] as number);
    const unit = mandatory ? 'disciplinas' : 'créditos';
    const left = Math.max(0, target - done);
    const pct = data.percent[type];
    const meta = `${done} de ${target} ${unit}${
      left ? ` · faltam ${left}` : ' · concluído'
    }`;
    return (
      <ListRow
        divider={divider}
        accessibilityLabel={`${name}: ${pct}%, ${meta}`}
        title={
          <Top>
            <Name variant="body" weight="semibold">
              {name}
            </Name>
            <Text variant="body" weight="semibold" tabular>
              {`${pct}%`}
            </Text>
          </Top>
        }
        meta={[
          <BarSlot
            key="bar"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <ProgressBar value={pct / 100} accessibilityLabel={name} />
          </BarSlot>,
          meta,
        ]}
      />
    );
  }

  const parts = [
    plural(data.completed[type], 'concluída', 'concluídas'),
    plural(
      data.completedCredits[type],
      'crédito concluído',
      'créditos concluídos',
    ),
  ];
  if (curriculumAvailable && type !== 'UNIVERSAL') {
    parts.push(`${data.totals[type]} no currículo`);
  }
  const meta = parts.join(' · ');
  const noGoal = !mandatory && !hasRequired;
  return (
    <ListRow
      divider={divider}
      accessibilityLabel={`${name}${noGoal ? ', sem meta' : ''}: ${meta}`}
      title={
        <Top>
          <Name variant="body" weight="semibold">
            {name}
          </Name>
          {noGoal ? <Tag label="Sem meta" /> : null}
        </Top>
      }
      meta={meta}
    />
  );
}

/** "Seu caminho no currículo": um grupo por tipo de disciplina. */
export function CurriculumPath({
  data,
  curriculumAvailable,
}: {
  data: PathData;
  curriculumAvailable: boolean;
}) {
  return (
    <List>
      {data.order.map(type => (
        <PathRow
          key={type}
          type={type}
          data={data}
          curriculumAvailable={curriculumAvailable}
        />
      ))}
    </List>
  );
}

export default CurriculumPath;
