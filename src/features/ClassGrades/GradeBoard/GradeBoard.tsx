import React, { useCallback, useMemo, useState } from 'react';
import {
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useTheme, type DefaultTheme } from 'styled-components/native';

import {
  Button,
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
import {
  finalExamOutlook,
  type FinalExamOutlook,
} from '@root/modules/academics/domain/rules/finalExam';
import { numberToColor } from '@utils/numberToColor';

import { FinalExamSheet } from '../FinalExamSheet';
import { formatTenth, outlookText } from '../finalExamText';
import {
  GradeSlot,
  GradeStrip,
  Legend,
  LegendItem,
  NameCell,
  SimulateButton,
  TargetSwatch,
} from './GradeBoard.styles';

type Props = {
  data: ClassGrade[];
  /**
   * Período exibido no cabeçalho ("2026.2"): rótulo da tabela e, na
   * simulação, a tentativa do histórico que é a deste quadro.
   */
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

/** Situações em que a folha de simulação tem uma média para mostrar. */
const SIMULATED = new Set<FinalExamOutlook['kind']>([
  'final-exam',
  'exempt',
  'no-final-exam',
  'final-exam-done',
  'published',
]);

const NO_ROWS: ClassGrade[] = [];

/**
 * Quadro de notas do período: tabela de fios P1, P2, PF e Média com a célula
 * tingida pela saúde e, abaixo do nome, um rótulo, para que a cor nunca seja
 * o único sinal. O rótulo diz o que falta para passar por nota, pela regra
 * do regime de créditos ("Precisa de 4,2 na PF", "Dispensado da PF"), e a PF
 * necessária aparece tracejada na coluna dela. Sem o que dizer, fica a saúde
 * da última nota ("Bom na P1"). "Simular PF e CR" abre a folha da simulação.
 *
 * As colunas de nota crescem com o tamanho de fonte do sistema. Quando isso
 * espremeria o nome (fonte grande ou tela estreita), cada linha passa a
 * mostrar as notas embaixo do nome, com o rótulo de cada uma.
 */
export const GradeBoard = React.memo(function GradeBoard({
  data,
  period,
}: Props) {
  const rows = data ?? NO_ROWS;
  const theme = useTheme();
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const [simulating, setSimulating] = useState(false);
  const outlooks = useMemo(
    () => rows.map(item => finalExamOutlook(item.grades)),
    [rows],
  );
  const hasTarget = outlooks.some(outlook => outlook.kind === 'final-exam');
  const canSimulate = outlooks.some(outlook => SIMULATED.has(outlook.kind));

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
          {rows.map((item, index) => {
            const { grades, id, name } = item;
            const outlook = outlooks[index];
            const latest = latestGrade(grades);
            const health = latest
              ? healthTone(numberToColor(latest.value))
              : 'neutral';
            const said = outlookText(outlook);
            const tone = said?.tone ?? health;
            let summary = 'Sem notas lançadas';
            if (said) summary = said.label;
            else if (latest)
              summary = `${HEALTH_LABEL[health]} na ${latest.name}`;
            const needed =
              outlook.kind === 'final-exam' ? outlook.needed : null;
            const values = GRADE_KEYS.map(([key, label]) => {
              if (key === 'pf' && needed !== null) {
                return `PF necessária ${formatTenth(needed)}`;
              }
              return `${label} ${
                isGrade(grades[key]) ? formatGrade(grades[key]) : 'sem nota'
              }`;
            }).join(', ');
            const nameCell = (
              <NameCell key="name">
                <Text weight="medium">{name}</Text>
                <StatusLabel tone={tone} label={summary} lines={2} />
              </NameCell>
            );
            const cells = GRADE_KEYS.map(([key, label]) => {
              const cell =
                key === 'pf' && needed !== null ? (
                  <GradeCell
                    key={key}
                    value={needed}
                    tone="neutral"
                    target
                    accessibilityLabel={`PF necessária ${formatTenth(needed)}`}
                  />
                ) : (
                  <GradeCell
                    key={key}
                    value={isGrade(grades[key]) ? grades[key] : null}
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
        {hasTarget ? (
          <LegendItem>
            <TargetSwatch />
            <Text variant="caption" weight="regular" tone="muted">
              Necessária na PF
            </Text>
          </LegendItem>
        ) : null}
      </Legend>
      {canSimulate ? (
        <>
          <SimulateButton>
            <Button
              variant="outline"
              icon="tune"
              label="Simular PF e CR"
              block
              onPress={() => setSimulating(true)}
            />
          </SimulateButton>
          <FinalExamSheet
            visible={simulating}
            onClose={() => setSimulating(false)}
            data={rows}
            period={period}
          />
        </>
      ) : null}
    </Section>
  );
});
