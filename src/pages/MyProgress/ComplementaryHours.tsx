import React, { useState } from 'react';
import styled from 'styled-components/native';

import {
  BottomSheet,
  FootNote,
  List,
  ListRow,
  ProgressBar,
  Section,
  Text,
} from '@components/ui';
import {
  summarizeComplementary,
  type ComplementarySummary,
  type ComplementaryType,
} from '@root/modules/academics/domain/rules/complementary';
import {
  useComplementaryActivities,
  useSynthesis,
} from '@root/modules/academics/presentation/queries';

/** "60", "7,5". */
function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace('.', ',');
}

/** "60 h", "7,5 h". */
function formatHours(value: number): string {
  return `${formatNumber(value)} h`;
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

/** O mesmo respiro da barra nas linhas do currículo. */
const BarSlot = styled.View`
  margin-top: 6px;
  margin-bottom: 2px;
`;

const Foot = styled.View`
  margin-top: ${({ theme }) => theme.spacing.md}px;
`;

function Bar({ value, label }: { value: number; label: string }) {
  return (
    <BarSlot
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <ProgressBar value={value} accessibilityLabel={label} />
    </BarSlot>
  );
}

/** O total: com a carga exigida pela Síntese, o quanto falta; sem ela, o que conta. */
function TotalRow({ summary }: { summary: ComplementarySummary }) {
  const { counted, excess, required } = summary;
  if (required) {
    const pct = Math.min(100, Math.round((counted / required) * 100));
    const left = Math.max(0, required - counted);
    const meta = `${formatHours(counted)} de ${formatHours(required)}${
      left ? ` · faltam ${formatHours(left)}` : ' · concluído'
    }`;
    return (
      <ListRow
        divider={summary.types.length > 0}
        accessibilityLabel={`Horas complementares: ${pct}%, ${meta}`}
        title={
          <Top>
            <Name variant="body" weight="semibold">
              Horas complementares
            </Name>
            <Text variant="body" weight="semibold" tabular>
              {`${pct}%`}
            </Text>
          </Top>
        }
        meta={[
          <Bar key="bar" value={pct / 100} label="Horas complementares" />,
          meta,
        ]}
      />
    );
  }
  const meta = excess
    ? `${formatHours(excess)} acima do teto de cada tipo não contam`
    : 'Cada tipo de atividade conta até um teto de horas.';
  return (
    <ListRow
      divider={summary.types.length > 0}
      accessibilityLabel={`Horas que contam: ${formatHours(counted)}. ${meta}`}
      title={
        <Top>
          <Name variant="body" weight="semibold">
            Horas que contam
          </Name>
          <Text variant="body" weight="semibold" tabular>
            {formatHours(counted)}
          </Text>
        </Top>
      }
      meta={meta}
    />
  );
}

/** "45 de 60 h · 15 h acima do teto · 3 atividades". */
function typeMeta(item: ComplementaryType): string {
  const parts = [
    item.maximum !== null
      ? `${formatNumber(item.counted)} de ${formatHours(item.maximum)}`
      : formatHours(item.counted),
  ];
  if (item.excess > 0) parts.push(`${formatHours(item.excess)} acima do teto`);
  const count = item.activities.length;
  if (count) parts.push(`${count} ${count === 1 ? 'atividade' : 'atividades'}`);
  return parts.join(' · ');
}

/**
 * Atividades complementares, no Meu Progresso: as horas que contam (cada tipo
 * de atividade só até o teto) e, quando a Síntese da Formação informa, a
 * carga exigida. Tocar num tipo mostra as atividades dele. Sem nada
 * registrado nem exigido, a seção não aparece.
 */
export function ComplementaryHours() {
  const { data } = useComplementaryActivities();
  const { data: synthesis } = useSynthesis();
  const [open, setOpen] = useState<ComplementaryType | null>(null);
  const summary = summarizeComplementary(data, synthesis);
  if (!summary) return null;

  return (
    <Section title="Atividades complementares">
      <List>
        <TotalRow summary={summary} />
        {summary.types.map((item, index) => {
          const meta = typeMeta(item);
          return (
            <ListRow
              key={item.type}
              divider={index < summary.types.length - 1}
              title={item.type}
              titleWeight="regular"
              titleLines={2}
              meta={
                item.maximum
                  ? [
                      <Bar
                        key="bar"
                        value={item.counted / item.maximum}
                        label={item.type}
                      />,
                      meta,
                    ]
                  : meta
              }
              accessibilityLabel={`${item.type}: ${meta}`}
              chevron={item.activities.length > 0}
              onPress={item.activities.length ? () => setOpen(item) : undefined}
            />
          );
        })}
      </List>
      <Foot>
        <FootNote
          text={
            summary.required
              ? 'As horas vêm de Disciplinas Realizadas e a carga exigida, da Síntese da Formação, no Aluno Online.'
              : 'As horas vêm de Disciplinas Realizadas, no Aluno Online. A carga exigida depende do seu curso.'
          }
        />
      </Foot>
      <BottomSheet
        visible={open !== null}
        onClose={() => setOpen(null)}
        title={open?.type ?? ''}
        meta={open ? formatHours(open.counted) : undefined}
      >
        <List>
          {(open?.activities ?? []).map((activity, index, all) => (
            <ListRow
              key={`${activity.period}-${index}`}
              divider={index < all.length - 1}
              title={activity.description || activity.type}
              titleWeight="regular"
              meta={activity.period ?? 'Sem período'}
              aside={
                activity.hours === null
                  ? undefined
                  : formatHours(activity.hours)
              }
            />
          ))}
        </List>
      </BottomSheet>
    </Section>
  );
}
