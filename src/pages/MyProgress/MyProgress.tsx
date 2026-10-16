import React, { useState } from 'react';
import Svg, { Line } from 'react-native-svg';
import { useTheme } from 'styled-components/native';

import {
  BlockedState,
  EmptyState,
  ErrorState,
  FootNote,
  IconButton,
  Notice,
  Section,
  StatGroup,
  Text,
} from '@components/ui';
import { ScreenPanel } from '@templates/ScreenPanel';
import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import { AppError } from '@root/shared/errors/AppError';
import { ElectiveCreditsConfig } from '@hooks/useElectiveCreditsConfig';

import { useMyProgress } from './useMyProgress';
import { CrChart } from './CrChart';
import { formatCr } from './crChartModel';
import { CurriculumPath, pathGoal } from './CurriculumPath';
import { CreditsSheet } from './CreditsSheet';
import { ProgressSkeleton } from './ProgressSkeleton';
import { ChartCard, Legend, LegendItem, NoticeSlot } from './MyProgress.styles';

const COPY = {
  error:
    'Não foi possível carregar seu progresso. Toque para tentar novamente.',
  empty: 'Ainda não há histórico ou currículo disponível.',
  approxCr:
    'O CR é calculado pelo app a partir do seu histórico e pode ser diferente do oficial.',
  curriculumUnavailable:
    'Currículo indisponível. Os totais e o progresso serão exibidos após o carregamento.',
  configureCredits: 'Configure os créditos necessários para ver o progresso.',
};

/** Amostras de 16×2 da legenda: linha cheia (CR) e tracejada (média). */
function LegendSwatch({ dashed }: { dashed?: boolean }) {
  const theme = useTheme();
  return (
    <Svg width={16} height={2}>
      <Line
        x1={0}
        x2={16}
        y1={1}
        y2={1}
        stroke={dashed ? theme.colors.inkSubtle : theme.colors.accent}
        strokeWidth={2}
        strokeDasharray={dashed ? '4 4' : undefined}
      />
    </Svg>
  );
}

export function MyProgressPage() {
  const [sheetVisible, setSheetVisible] = useState(false);

  const {
    initialLoading,
    isEmpty,
    curriculumAvailable,
    historyAvailable,
    approvedCount,
    currentCRA,
    crPoints,
    byType,
    electiveCreditsHook,
    error,
    dataUpdatedAt,
    isPaused,
    isFetching,
    retry,
  } = useMyProgress();

  const openSheet = () => setSheetVisible(true);
  const handleConfigSave = async (config: ElectiveCreditsConfig) => {
    return await electiveCreditsHook.setConfig(config);
  };

  const notice = (
    <QueryNotice
      dataUpdatedAt={dataUpdatedAt}
      isPaused={isPaused}
      isFetching={isFetching}
      error={error}
      hasData={!isEmpty}
      retry={retry}
    />
  );

  let content: React.ReactNode;
  if (initialLoading && isEmpty) {
    content = <ProgressSkeleton />;
  } else if (isEmpty) {
    const blocked =
      error instanceof AppError && error.code === 'POSSIBLY_BLOCKED';
    content = (
      <>
        {notice}
        {blocked ? (
          <BlockedState onRetry={retry} />
        ) : error ? (
          <ErrorState message={COPY.error} onRetry={retry} />
        ) : !isPaused ? (
          <EmptyState icon="school" text={COPY.empty} />
        ) : null}
      </>
    );
  } else {
    const missingCredits = byType.order.some(
      type =>
        type !== 'MANDATORY' &&
        !pathGoal(type, byType, curriculumAvailable).hasRequired,
    );
    content = (
      <>
        {notice}
        <StatGroup
          items={[
            { value: String(approvedCount), label: 'Disciplinas concluídas' },
            {
              value: historyAvailable ? formatCr(currentCRA) : '–',
              label: 'CR aproximado',
            },
          ]}
        />
        <FootNote text={COPY.approxCr} />

        {crPoints.length > 0 ? (
          <Section title="Evolução do CR">
            <Legend
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <LegendItem>
                <LegendSwatch />
                <Text variant="caption" weight="regular" tone="muted">
                  CR acumulado
                </Text>
              </LegendItem>
              <LegendItem>
                <LegendSwatch dashed />
                <Text variant="caption" weight="regular" tone="muted">
                  Média do período
                </Text>
              </LegendItem>
            </Legend>
            <ChartCard padding={0}>
              <CrChart points={crPoints} />
            </ChartCard>
          </Section>
        ) : null}

        <Section
          title="Seu caminho no currículo"
          action={
            <IconButton
              icon="settings"
              accessibilityLabel="Configurar créditos exigidos"
              onPress={openSheet}
            />
          }
        >
          {!curriculumAvailable ? (
            // "Tentar novamente" já está no aviso do topo (QueryNotice)
            <NoticeSlot>
              <Notice
                tone="neutral"
                icon="info"
                text={COPY.curriculumUnavailable}
              />
            </NoticeSlot>
          ) : missingCredits ? (
            <NoticeSlot>
              <Notice
                tone="info"
                icon="tune"
                text={COPY.configureCredits}
                action={{ label: 'Configurar créditos', onPress: openSheet }}
              />
            </NoticeSlot>
          ) : null}
          <CurriculumPath
            data={byType}
            curriculumAvailable={curriculumAvailable}
          />
        </Section>
      </>
    );
  }

  return (
    <>
      <ScreenPanel refreshing={isFetching && !isPaused} onRefresh={retry}>
        {content}
      </ScreenPanel>
      <CreditsSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSave={handleConfigSave}
        initialConfig={electiveCreditsHook.config}
      />
    </>
  );
}
