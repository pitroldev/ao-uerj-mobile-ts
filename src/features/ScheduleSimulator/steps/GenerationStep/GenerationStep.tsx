import { useGenerateSchedules } from '@root/modules/planning/presentation/useGenerateSchedules';
import { AppError, errorMessage } from '@root/shared/errors/AppError';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useFormContext, useWatch } from 'react-hook-form';
import styled, { useTheme } from 'styled-components/native';

import { useStepsContext } from '@hooks/useSteps';
import {
  ChipGroup,
  EmptyState,
  ErrorState,
  FilterChip,
  PropertyList,
  SegmentedControl,
  SkeletonList,
  Spinner,
  Tabs,
  Text,
} from '@components/ui';
import {
  ScheduleCreationParams,
  createScheduleDraft,
} from '@root/modules/planning/domain/models';

import { ScheduleVisualizer } from '../../ScheduleVisualizer';
import { ScheduleInfo } from '../../ScheduleInfo';
import { GeneratorStep, StepIntro, type StepAction } from '../../layout';
import { plural } from '../../format';

type Tab = 'INFO' | 'SCHEDULE';

const TABS: { value: Tab; label: string }[] = [
  { value: 'INFO', label: 'Informações' },
  { value: 'SCHEDULE', label: 'Horários' },
];

/** Até três grades cabem num controle segmentado; mais que isso, chips. */
const MAX_SEGMENTS = 3;

const Waiting = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  margin: 18px 0px 8px;
`;

const Summary = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  column-gap: 18px;
  margin-top: 14px;
`;

function SummaryItem({ value, label }: { value: number; label: string }) {
  return (
    <Text variant="meta" tone="muted">
      <Text variant="body" weight="semibold" tabular>
        {value}
      </Text>{' '}
      {label}
    </Text>
  );
}

export const GenerationStep = () => {
  const theme = useTheme();
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [currentTab, setCurrentTab] = React.useState<Tab>('INFO');

  const { setStep, prevStep } = useStepsContext();

  const { control, reset } = useFormContext<ScheduleCreationParams>();

  const body = useWatch({ control }) as ScheduleCreationParams;
  const generation = useGenerateSchedules();
  const { isPending: loading, data = [], error } = generation;
  const handleGenerate = () => {
    setSelectedIndex(0);
    generation.mutate(body);
  };

  const handleResetPress = () => {
    reset(createScheduleDraft());
    setStep(0);
  };

  const generatedSchedules = data;
  const selectedGeneration = generatedSchedules[selectedIndex];
  const selectedSchedule = selectedGeneration?.schedule;

  const hasData = data?.length > 0 && !error;
  const isEmpty = generation.isSuccess && data.length === 0;

  const next: StepAction = generation.isIdle
    ? { label: 'Gerar grades', icon: 'auto_awesome', onPress: handleGenerate }
    : loading
      ? { label: 'Gerar grades', loading: true, loadingLabel: 'Gerando…' }
      : {
          label: 'Gerar outra grade',
          icon: 'restart_alt',
          onPress: handleResetPress,
        };

  const title = loading
    ? 'Aguarde enquanto geramos sua grade'
    : generation.isIdle
      ? 'Tudo pronto para gerar sua grade'
      : 'Veja abaixo as grades geradas';

  const minimum = body.min_subject_amount;
  const maximum = body.max_subject_amount;
  const amount =
    minimum === maximum ? `${minimum ?? '–'}` : `${minimum} a ${maximum}`;
  const busyCount = body.busy_schedules?.length ?? 0;

  const errorText = error
    ? `${
        error instanceof AppError && error.code === 'INVALID_INPUT'
          ? error.message
          : errorMessage(error)
      } Toque aqui para tentar novamente.`
    : '';

  const emptyText =
    'Não foi possível gerar nenhuma grade com os dados informados, clique aqui para gerar outra grade';

  return (
    <GeneratorStep footer={{ onPrev: prevStep, next }}>
      <StepIntro
        live
        title={title}
        description={
          generation.isIdle
            ? 'Confira o resumo e toque em “Gerar grades”.'
            : undefined
        }
      />

      {generation.isIdle ? (
        <PropertyList
          layout="spread"
          style={styles.summary}
          items={[
            { label: 'Disciplinas por período', value: amount, tabular: true },
            {
              label: 'Horários ocupados',
              value: plural(busyCount, 'tempo', 'tempos'),
              tabular: true,
            },
            {
              label: 'Prioridades ligadas',
              value: body.priority?.length ?? 0,
              tabular: true,
            },
            {
              label: 'Disciplinas escolhidas',
              value: body.selectedSubjects?.length ?? 0,
              tabular: true,
            },
            {
              label: 'Turmas consideradas',
              value: body.selectedClasses?.length ?? 0,
              tabular: true,
            },
          ]}
        />
      ) : null}

      {loading ? (
        <>
          <Waiting accessibilityRole="progressbar" accessible>
            <Spinner size={theme.sizes.icon.xl} />
            <Text tone="muted">Combinando turmas e horários…</Text>
          </Waiting>
          <SkeletonList count={4} accessibilityLabel="Gerando grades…" />
        </>
      ) : null}

      {error ? (
        <ErrorState message={errorText} onRetry={handleGenerate} />
      ) : null}

      {isEmpty ? (
        <Pressable
          onPress={handleResetPress}
          accessibilityRole="button"
          accessibilityLabel={emptyText}
          style={({ pressed }) => [
            { borderRadius: theme.radii.xl },
            pressed && { backgroundColor: theme.colors.surfaceMuted },
          ]}
        >
          <EmptyState icon="event_busy" text={emptyText} />
        </Pressable>
      ) : null}

      {hasData && selectedGeneration ? (
        <>
          {generatedSchedules.length <= MAX_SEGMENTS ? (
            <SegmentedControl
              style={styles.picker}
              accessibilityLabel="Grades geradas"
              options={generatedSchedules.map((g, i) => ({
                value: String(i),
                label: `Grade ${i + 1}`,
              }))}
              value={String(selectedIndex)}
              onChange={v => setSelectedIndex(Number(v))}
            />
          ) : (
            <ChipGroup
              layout="scroll"
              accessibilityLabel="Grades geradas"
              style={styles.chips}
            >
              {generatedSchedules.map((g, i) => (
                <FilterChip
                  key={g.hash}
                  label={`Grade ${i + 1}`}
                  selected={i === selectedIndex}
                  onPress={() => setSelectedIndex(i)}
                />
              ))}
            </ChipGroup>
          )}

          <Summary
            accessible
            accessibilityLabel={`${plural(
              selectedSchedule.length,
              'disciplina',
              'disciplinas',
            )}, ${selectedGeneration.total_credits} créditos, ${
              selectedGeneration.total_workload
            } horas`}
          >
            <SummaryItem
              value={selectedSchedule.length}
              label={
                selectedSchedule.length === 1 ? 'disciplina' : 'disciplinas'
              }
            />
            <SummaryItem
              value={selectedGeneration.total_credits}
              label="créditos"
            />
            <SummaryItem
              value={selectedGeneration.total_workload}
              label="horas"
            />
          </Summary>

          <Tabs
            style={styles.tabs}
            tabs={TABS}
            value={currentTab}
            onChange={setCurrentTab}
          />
          {currentTab === 'SCHEDULE' ? (
            <ScheduleVisualizer data={selectedSchedule} />
          ) : (
            <ScheduleInfo schedule={selectedSchedule} />
          )}
        </>
      ) : null}
    </GeneratorStep>
  );
};

const styles = StyleSheet.create({
  summary: { marginTop: 18 },
  picker: { marginTop: 16 },
  chips: { marginTop: 10 },
  tabs: { marginTop: 20, marginBottom: 4 },
});
