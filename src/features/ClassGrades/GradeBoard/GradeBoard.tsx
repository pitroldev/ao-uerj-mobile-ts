import React, { useCallback, useMemo, useState } from 'react';
import {
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useTheme, type DefaultTheme } from 'styled-components/native';

import {
  formatGrade,
  GradeCell,
  HEALTH_LABEL,
  healthTone,
  Section,
  StatusLabel,
  Table,
  TableRow,
  Text,
  type TableColumn,
} from '@components/ui';
import { ClassGrade, Grade } from '@root/modules/academics/domain/models';
import { numberToColor } from '@utils/numberToColor';

import { GradeSlot, GradeStrip, Legend, NameCell } from './GradeBoard.styles';

type Props = {
  data: ClassGrade[];
  /** Período exibido no cabeçalho ("2026.2"), para o rótulo da tabela. */
  period?: string;
};

const GRADE_KEYS = [
  ['p1', 'P1'],
  ['p2', 'P2'],
  ['pf', 'PF'],
  ['result', 'Média'],
] as const;

/** Largura das colunas de nota no tamanho de fonte padrão (".gt", 45px). */
const BASE_GRADE_COLUMN = 45;
/** Respiro entre o nome e a primeira nota (padding da 1ª célula da `Table`). */
const NAME_GAP = 8;
/** Colunas da linha empilhada: uma só, com o nome e as notas embaixo. */
const STACKED_COLUMNS: TableColumn[] = [{ key: 'name', label: 'Disciplina' }];

/**
 * Largura das colunas P1/P2/PF/Média no tamanho de fonte do sistema. Cabe a
 * nota mais larga ("10,0": ~2,2em do `callout` mais o padding 6+6 da célula)
 * e o cabeçalho "Média" (~2,9em do `caption`) sem quebrar no meio da palavra.
 */
function gradeColumnWidth(theme: DefaultTheme, fontScale: number): number {
  const cell = 2.25 * theme.typography.callout.fontSize * fontScale + 12;
  const header = 3 * theme.typography.caption.fontSize * fontScale;
  return Math.max(BASE_GRADE_COLUMN, Math.ceil(Math.max(cell, header)));
}

/**
 * Espaço mínimo do nome da disciplina (~7em do `callout`, o bastante para
 * "Combinatória" numa linha). Abaixo disso as notas descem para baixo do nome.
 */
function minNameWidth(theme: DefaultTheme, fontScale: number): number {
  return 7 * theme.typography.callout.fontSize * fontScale;
}

function isGrade(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Nota mais recente: média, PF, P2 ou P1 (nessa ordem). */
function latestGrade(grades: Grade): { value: number; name: string } | null {
  if (isGrade(grades.result)) return { value: grades.result, name: 'média' };
  if (isGrade(grades.pf)) return { value: grades.pf, name: 'PF' };
  if (isGrade(grades.p2)) return { value: grades.p2, name: 'P2' };
  if (isGrade(grades.p1)) return { value: grades.p1, name: 'P1' };
  return null;
}

/**
 * Quadro de notas do período: tabela de fios P1, P2, PF e Média com a célula
 * tingida pela saúde e, abaixo do nome, o rótulo de onde ela vem ("Bom na
 * P1", "Atenção na média"), para que a cor nunca seja o único sinal.
 *
 * As colunas de nota crescem com o tamanho de fonte do sistema. Quando isso
 * espremeria o nome (fonte grande ou tela estreita), cada linha passa a
 * mostrar as notas embaixo do nome, com o rótulo de cada uma.
 */
const GradeBoard = ({ data, period }: Props) => {
  const rows = data ?? [];
  const theme = useTheme();
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  const scale = fontScale || 1;
  const columnWidth = gradeColumnWidth(theme, scale);
  const tableWidth = measuredWidth ?? windowWidth - 2 * theme.layout.gutter;
  const nameWidth = tableWidth - GRADE_KEYS.length * columnWidth - NAME_GAP;
  const stacked = nameWidth < minNameWidth(theme, scale);

  const columns = useMemo<TableColumn[]>(
    () =>
      stacked
        ? STACKED_COLUMNS
        : [
            { key: 'name', label: 'Disciplina' },
            ...GRADE_KEYS.map(([key, label]) => ({
              key,
              label,
              width: columnWidth,
              align: 'center' as const,
            })),
          ],
    [stacked, columnWidth],
  );

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0) setMeasuredWidth(width);
  }, []);

  return (
    <Section title="Notas">
      <View onLayout={onLayout}>
        <Table
          columns={columns}
          hideHeader={stacked}
          accessibilityLabel={
            period ? `Notas do período ${period}` : 'Notas do período'
          }
        >
          {rows.map(item => {
            const { grades, id, name } = item;
            const latest = latestGrade(grades);
            const tone = latest
              ? healthTone(numberToColor(latest.value))
              : 'neutral';
            const summary = latest
              ? `${HEALTH_LABEL[tone]} na ${latest.name}`
              : 'Sem notas lançadas';
            const values = GRADE_KEYS.map(
              ([key, label]) =>
                `${label} ${
                  isGrade(grades[key])
                    ? formatGrade(grades[key] as number)
                    : 'sem nota'
                }`,
            ).join(', ');
            const nameCell = (
              <NameCell key="name">
                <Text weight="medium">{name}</Text>
                <StatusLabel tone={tone} label={summary} />
              </NameCell>
            );
            const cells = GRADE_KEYS.map(([key, label]) => {
              const cell = (
                <GradeCell
                  key={key}
                  value={isGrade(grades[key]) ? (grades[key] as number) : null}
                />
              );
              return stacked ? (
                <GradeSlot key={key} $width={columnWidth}>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {label}
                  </Text>
                  {cell}
                </GradeSlot>
              ) : (
                cell
              );
            });
            return (
              <TableRow
                key={id}
                accessibilityLabel={`${name}: ${values}. ${summary}`}
              >
                {stacked ? (
                  <View>
                    {nameCell}
                    <GradeStrip>{cells}</GradeStrip>
                  </View>
                ) : (
                  [nameCell, ...cells]
                )}
              </TableRow>
            );
          })}
        </Table>
      </View>
      <Legend>
        <StatusLabel muted tone="good" label="Bom: 7 ou mais" />
        <StatusLabel muted tone="warn" label="Atenção: 5 a 6,9" />
        <StatusLabel muted tone="bad" label="Crítico: abaixo de 5" />
      </Legend>
    </Section>
  );
};

export default React.memo(GradeBoard);
