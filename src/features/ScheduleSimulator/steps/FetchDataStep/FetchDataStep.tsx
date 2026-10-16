import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import styled, { useTheme } from 'styled-components/native';

import { useStepsContext } from '@hooks/useSteps';
import {
  useCurriculum,
  useHistory,
} from '@root/modules/academics/presentation/queries';
import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import { usePlanningSubjects } from '@root/modules/planning/presentation/usePlanningSubjects';
import { ScheduleCreationParams } from '@root/modules/planning/domain/models';
import { availableClasses } from '@root/modules/planning/domain/rules';
import type { PlanningSubjectResult } from '@root/modules/planning/application/LoadPlanningSubjects';
import {
  EmptyState,
  ErrorState,
  Icon,
  List,
  ListRow,
  Notice,
  ProgressBar,
  Spinner,
  Text,
} from '@components/ui';

import { GeneratorStep, StepIntro } from '../../layout';
import {
  BLOCKED_TEXT,
  isPortalBlocked,
  lowerFirst,
  plural,
} from '../../format';

const Progress = styled.View`
  margin: 18px 0px 6px;
`;

const ProgressText = styled(Text)`
  margin-top: 8px;
`;

const RetryNotice = styled(Notice)`
  margin: 10px 0px 6px;
`;

/** Ícone de status com a largura do ".ic" (22). */
const StatusIcon = styled.View`
  width: 22px;
  align-items: center;
`;

type RowState = 'ok' | 'refused' | 'failed' | 'loading' | 'waiting';

/** Texto de cada linha; o ícone ao lado repete o status (nunca só a cor). */
const STATUS_TEXT: Record<
  RowState,
  (id: string, reason?: string | null) => string
> = {
  ok: id => `${id} · dados carregados`,
  refused: (_id, reason) =>
    reason ? `Recusada: ${lowerFirst(reason)}` : 'Recusada',
  failed: () => 'Falha ao carregar.',
  loading: () => 'Buscando…',
  waiting: () => 'Aguardando…',
};

function rowState(
  result: PlanningSubjectResult | undefined,
  busy: boolean,
): RowState {
  if (!result) return busy ? 'loading' : 'waiting';
  if (result.error) return 'failed';
  return result.eligible ? 'ok' : 'refused';
}

export const FetchDataStep = () => {
  const theme = useTheme();
  const { nextStep, prevStep } = useStepsContext();
  const { control, setValue, getValues } =
    useFormContext<ScheduleCreationParams>();
  const selectedSubjects = useWatch({ control, name: 'selectedSubjects' });
  const history = useHistory();
  const curriculum = useCurriculum();
  const progress = usePlanningSubjects(
    selectedSubjects,
    history.data,
    curriculum.data,
  );
  const complete =
    history.isSuccess &&
    progress.completed === selectedSubjects.length &&
    !progress.loading &&
    selectedSubjects.length > 0;
  const hasErrors = progress.results.some(result => result.error);
  const handleNext = () => {
    if (!complete || hasErrors || !history.data) return;
    const subjects = progress.results
      .filter(result => result.eligible)
      .map(result => result.details!);
    setValue('subjects', subjects);
    setValue('takenSubjects', history.data);
    setValue('curriculumSubjects', curriculum.data);
    setValue(
      'selectedClasses',
      availableClasses(subjects, getValues('busy_schedules')),
    );
    nextStep();
  };

  const historyFailed = Boolean(history.error) && !history.data;
  const retryHistory = () => {
    void history.refetch();
  };
  const busy = progress.loading || history.isLoading || history.isFetching;
  const total = selectedSubjects.length;
  const available = progress.results.filter(r => r.eligible).length;
  const refused = progress.results.filter(r => !r.eligible && !r.error).length;
  const failed = progress.results.filter(r => r.error).length;
  const byId = new Map(progress.results.map(r => [r.subject.id, r]));
  const subjects = [...new Map(selectedSubjects.map(s => [s.id, s])).values()];

  const summary = complete
    ? [
        plural(available, 'disponível', 'disponíveis'),
        plural(refused, 'recusada', 'recusadas'),
        failed ? `${failed} com falha` : null,
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  const renderStatus = (state: RowState) => {
    switch (state) {
      case 'ok':
        return (
          <Icon
            name="check_circle"
            filled
            size={theme.sizes.icon.xl}
            color={theme.status.good.ink}
          />
        );
      case 'refused':
        return (
          <Icon
            name="block"
            size={theme.sizes.icon.xl}
            color={theme.status.bad.ink}
          />
        );
      case 'failed':
        return (
          <Icon
            name="error"
            filled
            size={theme.sizes.icon.xl}
            color={theme.status.bad.ink}
          />
        );
      case 'loading':
        return (
          <Spinner size={theme.sizes.icon.xl} color={theme.colors.inkMuted} />
        );
      default:
        return (
          <Icon
            name="schedule"
            size={theme.sizes.icon.xl}
            color={theme.colors.inkMuted}
          />
        );
    }
  };

  return (
    <GeneratorStep
      footer={{
        onPrev: prevStep,
        next: {
          label: 'Próximo',
          icon: 'arrow_forward',
          iconPosition: 'end',
          onPress: handleNext,
          disabled:
            !complete ||
            hasErrors ||
            !progress.results.some(result => result.eligible),
        },
      }}
    >
      <QueryNotice
        dataUpdatedAt={history.dataUpdatedAt}
        isPaused={history.isPaused}
        isFetching={history.isFetching}
        error={history.error}
        hasData={history.data !== undefined}
        retry={history.refetch}
      />
      {curriculum.error ? (
        <RetryNotice
          tone="warn"
          text="Não foi possível conferir o currículo. Os pré-requisitos serão verificados com os dados disponíveis."
          onRetry={() => {
            void curriculum.refetch();
          }}
        />
      ) : null}
      <StepIntro
        live
        title={
          complete && !hasErrors
            ? 'Dados carregados com sucesso!'
            : complete
              ? 'Busca concluída com falhas'
              : 'Buscando dados das disciplinas'
        }
      />

      {historyFailed && isPortalBlocked(history.error) ? (
        <EmptyState
          icon="lock"
          tone="bad"
          text={BLOCKED_TEXT}
          action={{
            label: 'Tentar novamente',
            icon: 'refresh',
            onPress: retryHistory,
          }}
        />
      ) : historyFailed ? (
        <ErrorState
          message="Não foi possível carregar o histórico. Toque para tentar novamente."
          onRetry={retryHistory}
        />
      ) : (
        <>
          <Progress>
            <ProgressBar
              value={total ? progress.completed / total : 0}
              accessibilityLabel={`Disciplinas processadas: ${progress.completed} de ${total}`}
            />
            <ProgressText variant="meta" tone="muted">
              {progress.completed} de {total} disciplinas processadas
              {summary ? ` · ${summary}` : ''}
            </ProgressText>
          </Progress>

          {hasErrors && !progress.loading ? (
            <RetryNotice
              tone="warn"
              icon="sync_problem"
              text="Não foi possível carregar algumas disciplinas."
              onRetry={progress.retry}
            />
          ) : null}

          <List>
            {subjects.map(subject => {
              const result = byId.get(subject.id);
              const state = rowState(result, busy);
              const status = STATUS_TEXT[state](subject.id, result?.reason);
              const bad = state === 'refused' || state === 'failed';
              return (
                <ListRow
                  key={subject.id}
                  title={subject.name}
                  meta={
                    bad ? (
                      <Text variant="meta" tone="bad">
                        {status}
                      </Text>
                    ) : (
                      status
                    )
                  }
                  leading={<StatusIcon>{renderStatus(state)}</StatusIcon>}
                  accessibilityLabel={`${subject.name}, ${status}`}
                />
              );
            })}
          </List>
        </>
      )}
    </GeneratorStep>
  );
};
