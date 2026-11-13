import React, { useEffect, useEffectEvent, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useFormContext, useWatch } from 'react-hook-form';
import styled, { useTheme } from 'styled-components/native';

import { useStepsContext } from '@hooks/useSteps';
import {
  Button,
  ChipGroup,
  EmptyState,
  ErrorState,
  FilterChip,
  Icon,
  Notice,
  SegmentedControl,
  SkeletonList,
  Spinner,
  Tabs,
  Text,
  snackbar,
  type IconName,
} from '@components/ui';
import type { CurriculumSubject } from '@root/modules/academics/domain/models';
import { toSvgDataUri } from '@root/modules/academics/presentation/scheduleSvg';
import { useScheduleSharing } from '@root/modules/academics/presentation/useScheduleSharing';
import { useCanInvite } from '@root/modules/delivery/presentation/DeliveryProvider';
import { plannedScheduleCaption } from '@root/modules/delivery/presentation/inviteText';
import {
  assembleGeneration,
  type SubjectAvailability,
} from '@root/modules/planning/domain/availability';
import { leftOutReason } from '@root/modules/planning/domain/leftOut';
import {
  GOALS,
  classKey,
  createGeneratorDraft,
  goalOf,
  type GeneratedClassWithSubject,
  type GeneratorDraft,
  type Goal,
  type ScheduleCreationParams,
} from '@root/modules/planning/domain/models';
import {
  SubjectShortfall,
  TooManyClasses,
  availableClasses,
  type ShortfallReason,
} from '@root/modules/planning/domain/rules';
import { useGenerateSchedules } from '@root/modules/planning/presentation/useGenerateSchedules';
import {
  useGeneratorRunNote,
  useGeneratorRunStart,
} from '@root/modules/planning/presentation/useGeneratorRun';
import { usePlanningCatalog } from '@root/modules/planning/presentation/usePlanningCatalog';
import { AppError, errorMessage } from '@root/shared/errors/AppError';

import { CriticalityNotice } from '../../criticality/CriticalityNotice';
import { useCriticality } from '../../criticality/context';
import { ScheduleVisualizer } from '../../ScheduleVisualizer';
import { ScheduleInfo } from '../../ScheduleInfo';
import { GeneratorStep, StepIntro } from '../../layout';
import {
  ROUTINE_STEP,
  SUBJECTS_STEP,
  joinPt,
  lowerFirst,
  plural,
} from '../../format';
import { buildPlanImage, roomsOf } from '../../planImage';
import { ClassesSheet, GOAL_COPY, GoalSheet, LimitSheet } from './AdjustSheets';

type Tab = 'SCHEDULE' | 'INFO';

const TABS: { value: Tab; label: string }[] = [
  { value: 'SCHEDULE', label: 'Horários' },
  { value: 'INFO', label: 'Disciplinas' },
];

type SheetName = 'limit' | 'goal' | 'classes';

/** Até três grades cabem num controle segmentado; mais que isso, chips. */
const MAX_SEGMENTS = 3;

const NO_SUBJECTS: CurriculumSubject[] = [];

/** Dois quadros: o SVG novo já está desenhado quando a captura acontece. */
const nextPaint = () =>
  new Promise<void>(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

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
  row-gap: 6px;
  margin-top: 14px;
`;

const SummaryRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
`;

const LeftOutLine = styled(Text)`
  margin-top: 2px;
`;

const Restart = styled.View`
  align-items: center;
  margin-top: 20px;
`;

/** Um número da grade com o ícone dele (disciplinas, créditos, horas, dias). */
function SummaryItem({
  icon,
  value,
  label,
}: {
  icon: IconName;
  value: number;
  label: string;
}) {
  const theme = useTheme();
  return (
    <SummaryRow>
      <Icon
        name={icon}
        size={theme.sizes.icon.sm}
        color={theme.colors.inkMuted}
      />
      <Text variant="meta" tone="muted">
        <Text variant="body" weight="semibold" tabular>
          {value}
        </Text>{' '}
        {label}
      </Text>
    </SummaryRow>
  );
}

/** Para onde levar o aluno quando nenhuma disciplina pode entrar. */
const SHORTFALL_FIX: Record<
  ShortfallReason,
  { label: string; step?: number; sheet?: SheetName }
> = {
  ROUTINE: { label: 'Rever horários', step: ROUTINE_STEP },
  SUBJECTS: { label: 'Escolher disciplinas', step: SUBJECTS_STEP },
  SELECTION: { label: 'Rever turmas', sheet: 'classes' },
};

/** O que muda o resultado: dois pedidos com a mesma assinatura dão as mesmas grades. */
const requestSignature = (form: ScheduleCreationParams): string =>
  JSON.stringify([
    form.subjects.map(item => item.id),
    form.selectedClasses.map(classKey),
    form.busy_schedules,
    form.lunch ?? null,
    form.max_subject_amount,
    form.priority,
    form.criticality ?? null,
  ]);

/** Por que uma disciplina escolhida não está na grade que o aluno vê. */
function leftOutText(
  subject: CurriculumSubject,
  state: SubjectAvailability | undefined,
  grade: readonly GeneratedClassWithSubject[],
  params: ScheduleCreationParams,
  removed: ReadonlySet<string>,
): string {
  if (!state || state.status === 'loading') return 'ainda buscando as turmas';
  if (state.status === 'failed') return 'não deu para buscar as turmas';
  if (state.status === 'refused') return lowerFirst(state.reason);
  if (!state.details.classes?.length) return 'sem turmas neste período';
  const reason = leftOutReason({
    subject: state.details,
    grade,
    busy: params.busy_schedules,
    lunch: params.lunch,
    removed,
  });
  switch (reason.kind) {
    case 'ROUTINE': {
      const one = reason.classes === 1;
      if (reason.by === 'LUNCH')
        return one
          ? 'a turma não deixa o almoço que você pediu'
          : 'as turmas não deixam o almoço que você pediu';
      if (reason.by === 'BUSY')
        return one
          ? 'a turma bate com seus horários ocupados'
          : 'as turmas batem com seus horários ocupados';
      return 'as turmas batem com seus horários ocupados ou não deixam o almoço';
    }
    case 'REMOVED':
      return 'você tirou as turmas dela';
    case 'LUNCH':
      return 'tiraria seu horário de almoço';
    case 'LIMIT':
      return `cabe, mas passaria do limite de ${plural(params.max_subject_amount ?? 1, 'disciplina', 'disciplinas')}`;
    case 'CLASH':
      return reason.with.length
        ? `bate com ${joinPt(reason.with)}`
        : 'bate com outra disciplina da grade';
  }
}

/**
 * Passo 3: as grades. Chegar aqui já gera, e cada ajuste (limite de
 * disciplinas, o que importa, turmas) gera de novo ao fechar a folha. A
 * grade que deixa disciplinas de fora diz quais e por quê.
 */
export const ResultsStep = () => {
  const theme = useTheme();
  // a grade escolhida vale só para o resultado em que foi escolhida
  const [picked, setPicked] = useState({ run: '', index: 0 });
  const [currentTab, setCurrentTab] = useState<Tab>('SCHEDULE');
  const [sheet, setSheet] = useState<SheetName | null>(null);

  const { setStep, prevStep } = useStepsContext();
  const { control, reset, setValue, getValues } =
    useFormContext<GeneratorDraft>();
  const draft = useWatch({ control }) as GeneratorDraft;
  const selectedSubjects = draft.selectedSubjects ?? NO_SUBJECTS;

  const catalog = usePlanningCatalog(selectedSubjects);
  const generation = useGenerateSchedules();
  const criticality = useCriticality();
  const startRun = useGeneratorRunStart();
  const note = useGeneratorRunNote();
  const { share, exporting, SvgRenderer } = useScheduleSharing();
  // numa loja, a imagem diz onde baixar e a legenda leva o link
  const store = useCanInvite();
  const [planSvg, setPlanSvg] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const params = assembleGeneration({
    draft,
    availability: catalog.availability,
    history: catalog.history.data ?? [],
    curriculum: catalog.curriculum.data,
  });
  // "Adiantar o curso" soma quantas obrigatórias cada disciplina trava
  const counts = draft.priority.includes('CRITICAL_FIRST')
    ? criticality.criticalityFor(
        params.subjects.flatMap(item => (item.id ? [item.id] : [])),
      )
    : undefined;
  const request = counts ? { ...params, criticality: counts } : params;
  const signature = requestSignature(request);
  const settled = catalog.loading === 0;
  // o pedido que o gerador recebeu por último é o de agora
  const fresh =
    generation.variables !== undefined &&
    requestSignature(generation.variables) === signature;
  const selectedIndex = picked.run === signature ? picked.index : 0;
  const setSelectedIndex = (index: number) =>
    setPicked({ run: signature, index });

  const generate = () => generation.mutate(request);
  const generateIfChanged = useEffectEvent(() => {
    if (!fresh) generate();
  });
  // gera ao chegar e a cada mudança, com as turmas lidas e as folhas fechadas
  useEffect(() => {
    if (settled && sheet === null) generateIfChanged();
  }, [settled, sheet, signature]);

  const { error } = generation;
  const generated = fresh && generation.isSuccess ? generation.data : undefined;
  const loading = !settled || (!fresh && !error) || generation.isPending;

  // o resultado, para o relato da tela: quantas grades e a maior delas
  useEffect(() => {
    if (generated) {
      note({
        outcome: generated.length ? 'SCHEDULES' : 'EMPTY',
        schedules: generated.length,
        largestSchedule: Math.max(
          0,
          ...generated.map(item => item.schedule.length),
        ),
      });
    } else if (error) {
      note({
        outcome:
          error instanceof SubjectShortfall
            ? `SHORTFALL_${error.reason}`
            : error instanceof TooManyClasses
              ? 'TOO_MANY_CLASSES'
              : error instanceof AppError
                ? error.code
                : 'UNEXPECTED',
      });
    }
  }, [note, generated, error]);

  const handleReset = () => {
    startRun();
    reset(createGeneratorDraft());
    setStep(SUBJECTS_STEP);
  };

  const removed = new Set(draft.removedClasses ?? []);
  const toggleClass = (key: string) => {
    const current = getValues('removedClasses') ?? [];
    setValue(
      'removedClasses',
      current.includes(key)
        ? current.filter(item => item !== key)
        : [...current, key],
    );
  };
  const usableClasses = availableClasses(
    params.subjects,
    params.busy_schedules,
    params.lunch,
  ).length;

  const goal = goalOf(draft.priority ?? []);
  const limit = params.max_subject_amount ?? 1;
  const canEnter = params.subjects.length;

  // só as grades com o máximo de disciplinas que coube: as menores são a
  // mesma grade sem uma disciplina (quem quer menos usa o limite)
  const best = Math.max(
    0,
    ...(generated ?? []).map(item => item.schedule.length),
  );
  const schedules = (generated ?? []).filter(
    item => item.schedule.length === best,
  );
  const current = schedules[selectedIndex] ?? schedules[0];
  const grade = current?.schedule;

  const inGrade = new Set((grade ?? []).map(item => item.subject_id));
  const leftOut = grade
    ? selectedSubjects
        .filter(subject => !inGrade.has(subject.id))
        .map(subject => ({
          subject,
          text: leftOutText(
            subject,
            catalog.availability.get(subject.id),
            grade,
            params,
            removed,
          ),
        }))
    : [];

  const shortfall = error instanceof SubjectShortfall ? error : null;
  const tooMany = error instanceof TooManyClasses ? error : null;
  const fix = shortfall ? SHORTFALL_FIX[shortfall.reason] : null;

  const title = loading
    ? settled
      ? 'Montando suas grades…'
      : 'Buscando as turmas…'
    : error
      ? 'Não deu para montar a grade'
      : schedules.length
        ? schedules.length === 1
          ? 'Sua grade'
          : 'Suas grades'
        : 'Nenhuma grade com essas escolhas';

  // a imagem é a da grade à vista, desenhada no toque: o `SvgRenderer` a
  // pinta fora da tela e, dois quadros depois, a captura já pega o desenho
  const shareable = !loading && current && grade ? current : null;
  const handleShare = async () => {
    if (!shareable || preparing) return;
    setPreparing(true);
    const svg = buildPlanImage(shareable.schedule, {
      rooms: roomsOf(params.subjects),
      credits: shareable.total_credits,
      store,
    });
    setPlanSvg(svg);
    await nextPaint();
    setPreparing(false);
    try {
      await share(
        toSvgDataUri(svg),
        store ? plannedScheduleCaption() : undefined,
      );
    } catch {
      snackbar.error(
        'Não foi possível compartilhar a grade.',
        'Tente novamente.',
      );
    }
  };

  return (
    <GeneratorStep
      footer={{
        onPrev: prevStep,
        next: {
          label: 'Compartilhar',
          icon: 'share',
          disabled: !shareable,
          loading: exporting || preparing,
          loadingLabel: 'Preparando…',
          onPress: () => {
            void handleShare();
          },
        },
      }}
    >
      <StepIntro live title={title} />

      {settled ? (
        <ChipGroup
          layout="scroll"
          accessibilityLabel="Ajustes da grade"
          style={styles.adjust}
        >
          <FilterChip
            menu
            label={`Até ${plural(limit, 'disciplina', 'disciplinas')}`}
            accessibilityLabel={`Limite: até ${plural(limit, 'disciplina', 'disciplinas')}. Mudar`}
            disabled={canEnter < 2}
            onPress={() => setSheet('limit')}
          />
          <FilterChip
            menu
            label={goal ? GOAL_COPY[goal].chip : 'O que importa'}
            accessibilityLabel={`O que mais importa: ${goal ? GOAL_COPY[goal].label : 'não escolhido'}. Mudar`}
            onPress={() => setSheet('goal')}
          />
          <FilterChip
            menu
            label={plural(params.selectedClasses.length, 'turma', 'turmas')}
            accessibilityLabel={`${plural(params.selectedClasses.length, 'turma', 'turmas')} de ${usableClasses}. Escolher turmas`}
            disabled={usableClasses === 0}
            onPress={() => setSheet('classes')}
          />
        </ChipGroup>
      ) : null}

      {/* "Adiantar o curso" com os pré-requisitos ainda por ler */}
      <CriticalityNotice summary style={styles.notice} />

      {catalog.failed ? (
        <Notice
          tone="warn"
          icon="sync_problem"
          text={`Não deu para buscar as turmas de ${plural(catalog.failed, 'disciplina', 'disciplinas')}. As grades saem sem ${catalog.failed === 1 ? 'ela' : 'elas'}.`}
          onRetry={catalog.retry}
          style={styles.notice}
        />
      ) : null}

      {loading ? (
        <>
          <Waiting accessibilityRole="progressbar" accessible>
            <Spinner size={theme.sizes.icon.xl} />
            <Text tone="muted">
              {settled
                ? 'Combinando turmas e horários…'
                : `Buscando as turmas de ${plural(catalog.loading, 'disciplina', 'disciplinas')}…`}
            </Text>
          </Waiting>
          <SkeletonList count={4} accessibilityLabel="Gerando grades…" />
        </>
      ) : fix ? (
        <EmptyState
          icon="event_busy"
          tone="bad"
          text={shortfall?.message ?? ''}
          action={{
            label: fix.label,
            icon: fix.sheet ? 'groups' : 'arrow_back',
            onPress: () =>
              fix.sheet ? setSheet(fix.sheet) : setStep(fix.step ?? 0),
          }}
        />
      ) : tooMany ? (
        <EmptyState
          icon="groups"
          tone="bad"
          text={tooMany.message}
          action={{
            label: 'Escolher turmas',
            icon: 'groups',
            onPress: () => setSheet('classes'),
          }}
        />
      ) : error ? (
        <ErrorState
          message={`${
            error instanceof AppError && error.code === 'INVALID_INPUT'
              ? error.message
              : errorMessage(error)
          } Toque aqui para tentar novamente.`}
          onRetry={generate}
        />
      ) : !schedules.length ? (
        <EmptyState
          icon="event_busy"
          text="Nenhuma combinação coube. Libere horários ou troque disciplinas."
          action={{
            label: 'Rever horários',
            icon: 'arrow_back',
            onPress: () => setStep(ROUTINE_STEP),
          }}
        />
      ) : null}

      {!loading && current && grade ? (
        <>
          {schedules.length > 1 ? (
            schedules.length <= MAX_SEGMENTS ? (
              <SegmentedControl
                style={styles.picker}
                accessibilityLabel="Grades geradas"
                options={schedules.map((g, i) => ({
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
                {schedules.map((g, i) => (
                  <FilterChip
                    key={g.hash}
                    label={`Grade ${i + 1}`}
                    selected={i === selectedIndex}
                    onPress={() => setSelectedIndex(i)}
                  />
                ))}
              </ChipGroup>
            )
          ) : null}

          <Summary
            accessible
            accessibilityLabel={`${plural(
              grade.length,
              'disciplina',
              'disciplinas',
            )}, ${current.total_credits} créditos, ${
              current.total_workload
            } horas, ${plural(current.total_week_days, 'dia', 'dias')} com aula`}
          >
            <SummaryItem
              icon="menu_book"
              value={grade.length}
              label={grade.length === 1 ? 'disciplina' : 'disciplinas'}
            />
            <SummaryItem
              icon="workspace_premium"
              value={current.total_credits}
              label="créditos"
            />
            <SummaryItem
              icon="schedule"
              value={current.total_workload}
              label="horas"
            />
            <SummaryItem
              icon="calendar_today"
              value={current.total_week_days}
              label={current.total_week_days === 1 ? 'dia' : 'dias'}
            />
          </Summary>

          {leftOut.length ? (
            <Notice tone="info" icon="info" style={styles.notice}>
              <Text variant="meta" weight="semibold">
                {leftOut.length === 1 ? 'Ficou de fora' : 'Ficaram de fora'}
              </Text>
              {leftOut.map(({ subject, text }) => (
                <LeftOutLine key={subject.id} variant="meta">
                  {subject.name}: {text}
                </LeftOutLine>
              ))}
            </Notice>
          ) : null}

          <Tabs
            style={styles.tabs}
            tabs={TABS}
            value={currentTab}
            onChange={setCurrentTab}
          />
          {currentTab === 'SCHEDULE' ? (
            <ScheduleVisualizer data={grade} />
          ) : (
            <ScheduleInfo schedule={grade} />
          )}
        </>
      ) : null}

      {settled ? (
        <Restart>
          <Button
            variant="text"
            size="sm"
            icon="restart_alt"
            label="Começar de novo"
            onPress={handleReset}
          />
        </Restart>
      ) : null}

      {planSvg ? <SvgRenderer svgString={planSvg} /> : null}

      <LimitSheet
        visible={sheet === 'limit'}
        onClose={() => setSheet(null)}
        value={limit}
        max={Math.max(1, canEnter)}
        onApply={value => setValue('maxSubjects', value)}
      />
      <GoalSheet
        visible={sheet === 'goal'}
        onClose={() => setSheet(null)}
        value={goal}
        onSelect={(choice: Goal) => setValue('priority', [...GOALS[choice]])}
      />
      <ClassesSheet
        visible={sheet === 'classes'}
        onClose={() => setSheet(null)}
        subjects={params.subjects}
        busy={params.busy_schedules}
        lunch={params.lunch ?? null}
        removed={removed}
        onToggle={toggleClass}
      />
    </GeneratorStep>
  );
};

const styles = StyleSheet.create({
  adjust: { marginTop: 14 },
  notice: { marginTop: 16 },
  picker: { marginTop: 18 },
  chips: { marginTop: 14 },
  tabs: { marginTop: 20, marginBottom: 4 },
});
