import React, { useCallback, useMemo, useState } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import { useTheme } from 'styled-components/native';

import {
  BottomSheet,
  Button,
  Card,
  FootNote,
  Icon,
  Notice,
  Skeleton,
  StatusLabel,
  Tag,
  Text,
} from '@components/ui';
import type { ClassGrade } from '@root/modules/academics/domain/models';
import {
  finalExamOutlook,
  finalGrade,
  isPassingGrade,
  projectCumulativeAverage,
  projectedFinal,
  type FinalExamOutlook,
  type PeriodFinal,
} from '@root/modules/academics/domain/rules/finalExam';
import { subjectKey } from '@root/modules/academics/domain/rules/subjectId';
import { useSubjectLoads } from '@root/modules/academics/presentation/useSubjectLoads';
import { formatGrade } from '@utils/formatGrade';

import { formatTenth } from '../finalExamText';
import { GradeStepper } from './GradeStepper';
import {
  CrCard,
  CrDelta,
  CrHead,
  CrValues,
  Empty,
  Foot,
  Intro,
  SimControls,
  SimHead,
  SimName,
  SimRow,
  Waiting,
} from './FinalExamSheet.styles';

type Props = {
  visible: boolean;
  onClose: () => void;
  data: ClassGrade[];
  /** Período do quadro ("2026.1"), quando o portal o informa. */
  period?: string;
};

type PendingExam = Extract<FinalExamOutlook, { kind: 'final-exam' }>;
type Row = { item: ClassGrade; key: string; outlook: FinalExamOutlook };

const RULE_NOTE =
  'Regra do regime de créditos (Deliberação nº 33/1995, art. 95): média das provas a partir de 7,0 dispensa a PF; abaixo de 4,0, reprova sem PF. Com PF, a média final é (média + PF) ÷ 2 e aprova com 5,0. A frequência mínima é de 75%.';

function formatCr(value: number | null): string {
  return value === null ? '–' : value.toFixed(2).replace('.', ',');
}

/**
 * Folha "Simular PF e CR": a PF de cada disciplina que precisa dela (começa
 * na nota mínima a cada abertura), a média final e o CR aproximado com as
 * notas do período. A conta é local; o histórico, de onde vêm os créditos, só
 * é lido com a folha aberta.
 */
export function FinalExamSheet({ visible, onClose, data, period }: Props) {
  const [exams, setExams] = useState<Record<string, number>>({});
  const changeExam = useCallback((id: string, value: number) => {
    setExams(previous => ({ ...previous, [id]: value }));
  }, []);
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onClosed={() => setExams({})}
      title="Simular PF e CR"
      footer={[
        <Button
          key="reset"
          variant="outline"
          icon="restart_alt"
          label="Restaurar"
          onPress={() => setExams({})}
        />,
        <Button key="done" label="Pronto" onPress={onClose} />,
      ]}
    >
      <Simulation
        data={data}
        period={period}
        exams={exams}
        onExamChange={changeExam}
      />
    </BottomSheet>
  );
}

function Simulation({
  data,
  period,
  exams,
  onExamChange,
}: {
  data: ClassGrade[];
  period?: string;
  exams: Record<string, number>;
  onExamChange: (id: string, value: number) => void;
}) {
  const rows = useMemo<Row[]>(
    () =>
      data.map(item => ({
        item,
        key: subjectKey(item.id),
        outlook: finalExamOutlook(item.grades),
      })),
    [data],
  );
  const examOf = (row: Row) =>
    exams[row.item.id] ?? (row.outlook as PendingExam).needed;
  const pending = rows.filter(row => row.outlook.kind === 'final-exam');
  const finals = new Map<string, PeriodFinal>();
  const names = new Map(rows.map(row => [row.key, row.item.name]));
  const waiting: string[] = [];
  for (const row of rows) {
    const simulated = row.outlook.kind === 'final-exam';
    const grade = projectedFinal(
      row.outlook,
      simulated ? examOf(row) : undefined,
    );
    if (grade !== null) finals.set(row.key, { grade, simulated });
    else waiting.push(row.item.name);
  }

  return (
    <>
      <Intro tone="muted">
        Mude a nota da PF para ver a média final e o CR aproximado. A conta é
        feita no aparelho.
      </Intro>
      {pending.length ? (
        pending.map(row => (
          <SimulationRow
            key={row.item.id}
            name={row.item.name}
            average={(row.outlook as PendingExam).average}
            exam={examOf(row)}
            onChange={value => onExamChange(row.item.id, value)}
          />
        ))
      ) : (
        <Empty tone="muted">Nenhuma disciplina precisa de PF agora.</Empty>
      )}
      <CrProjection finals={finals} names={names} period={period} />
      {waiting.length ? (
        <Waiting variant="meta" tone="muted">
          {waiting.length === 1 ? 'Fica' : 'Ficam'} de fora até as duas provas
          saírem: {waiting.join(', ')}.
        </Waiting>
      ) : null}
      <Foot>
        <FootNote icon="info" text={RULE_NOTE} />
      </Foot>
    </>
  );
}

function SimulationRow({
  name,
  average,
  exam,
  onChange,
}: {
  name: string;
  average: number;
  exam: number;
  onChange: (value: number) => void;
}) {
  const final = finalGrade(average, exam);
  const passed = isPassingGrade(final);
  const change = (value: number) => {
    onChange(value);
    // no Android as live regions leem a PF e a média final; o VoiceOver não
    // lê live regions, então a mudança entra na fila de fala
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibilityWithOptions(
        `PF ${formatTenth(value)}, média final ${formatGrade(finalGrade(average, value))}`,
        { queue: true },
      );
    }
  };
  return (
    <SimRow>
      <SimHead>
        <SimName variant="body" weight="semibold">
          {name}
        </SimName>
        <Text variant="meta" tone="muted" tabular>
          Média {formatGrade(average)}
        </Text>
      </SimHead>
      <SimControls>
        <GradeStepper value={exam} onChange={change} label={`PF de ${name}`} />
        <View accessibilityLiveRegion="polite">
          <StatusLabel
            tone={passed ? 'good' : 'bad'}
            icon={passed ? 'check_circle' : 'cancel'}
            label={`Média final ${formatGrade(final)}`}
          />
        </View>
      </SimControls>
    </SimRow>
  );
}

/**
 * CR aproximado de agora e com as notas do período (simuladas ou não). Os
 * créditos de cada disciplina vêm do histórico, do currículo ou das
 * universais.
 */
function CrProjection({
  finals,
  names,
  period,
}: {
  finals: ReadonlyMap<string, PeriodFinal>;
  names: ReadonlyMap<string, string>;
  period?: string;
}) {
  const theme = useTheme();
  const { loads, history, loading, failed, retry } = useSubjectLoads();

  if (history.data === undefined) {
    return (
      <CrCard>
        {history.isLoading ? (
          <Card>
            <Skeleton width={120} height={16} />
            <Skeleton width={180} height={32} />
          </Card>
        ) : (
          <Notice
            tone="neutral"
            icon="info"
            text="O CR depende do histórico, que não foi carregado."
            onRetry={() => {
              void history.refetch();
            }}
          />
        )}
      </CrCard>
    );
  }

  const credits = new Map(
    [...finals.keys()].map(key => [key, loads.get(key)?.credits ?? null]),
  );
  const { current, projected, counted, missing } = projectCumulativeAverage(
    history.data,
    finals,
    credits,
    period,
  );
  const delta =
    current !== null && projected !== null
      ? Math.round((projected - current) * 100) / 100
      : null;
  let note = 'Nenhuma disciplina deste período entra na conta ainda.';
  if (counted.length === 1) {
    note = 'Inclui 1 disciplina deste período.';
  } else if (counted.length > 1) {
    note = `Inclui ${counted.length} disciplinas deste período.`;
  }
  if (current === null) note = `Você ainda não tem CR no histórico. ${note}`;
  if (missing.length) {
    note += loading
      ? ' Buscando os créditos das outras…'
      : ` Sem os créditos de ${missing.map(key => names.get(key) ?? key).join(', ')}.`;
  }
  note += ' Calculado pelo app; o oficial pode ser diferente.';
  const canRetry = missing.length > 0 && failed && !loading;

  return (
    <>
      <CrCard
        accessible
        accessibilityLabel={`CR aproximado: ${current === null ? 'sem CR ainda' : formatCr(current)}; com as notas do período, ${projected === null ? 'sem CR' : formatCr(projected)}. ${note}`}
      >
        <Card>
          <CrHead>
            <Text variant="meta" tone="muted">
              CR aproximado
            </Text>
            <Tag tone="info" label="Simulação" />
          </CrHead>
          <CrValues>
            <Text variant="display" tone="muted" tabular>
              {formatCr(current)}
            </Text>
            <Icon
              name="arrow_forward"
              size={theme.sizes.icon.lg}
              color={theme.colors.inkSubtle}
            />
            <Text variant="display" tabular>
              {formatCr(projected)}
            </Text>
            {delta !== null ? (
              <CrDelta>
                <StatusLabel
                  tone={delta > 0 ? 'good' : delta < 0 ? 'bad' : 'neutral'}
                  icon={
                    delta > 0
                      ? 'trending_up'
                      : delta < 0
                        ? 'trending_down'
                        : undefined
                  }
                  label={`${delta > 0 ? '+' : delta < 0 ? '−' : ''}${formatCr(Math.abs(delta))}`}
                />
              </CrDelta>
            ) : null}
          </CrValues>
          <Text variant="meta" tone="muted">
            {note}
          </Text>
        </Card>
      </CrCard>
      {canRetry ? (
        <Button
          variant="text"
          size="sm"
          icon="refresh"
          label="Buscar os créditos de novo"
          onPress={retry}
        />
      ) : null}
    </>
  );
}
