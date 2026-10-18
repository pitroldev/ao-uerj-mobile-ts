import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { parseName } from '@services/parser';
import { useIdentity } from '@root/app/providers/AppServicesProvider';
import {
  useGrades,
  useSchedule,
  usePartialRid,
  isPortalBlocked,
} from '@root/modules/academics/presentation/queries';
import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import { useOnlineStatus } from '@root/modules/academics/presentation/useOnlineStatus';
import { RemoteNotices } from '@root/modules/delivery/presentation/RemoteNotices';
import { ReminderPrompt } from '@root/modules/notifications/presentation/ReminderPrompt';
import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';

import { ScreenPanel } from '@templates/ScreenPanel';
import { BlockedState, EmptyState, ErrorState, Notice } from '@components/ui';

import { AppInfoModal } from '@features/AppInfoModal';
import { RIDBoard } from '@features/PartialRID/RIDBoard';
import { GradeBoard } from '@features/ClassGrades/GradeBoard';
import { NextClassCard } from '@features/AttendedClassesSchedule/NextClassCard';
import { ClassScheduleBoard } from '@features/AttendedClassesSchedule/ClassScheduleBoard';
import { AttendedClassesBoard } from '@features/AttendedClassesSchedule/AttendedClassesBoard';
import { dateLabel } from '@features/AttendedClassesSchedule/scheduleFormat';
import { useNow } from '@features/AttendedClassesSchedule/useNow';

import { HomeGreeting } from './components/HomeGreeting';
import { HomeHelp } from './components/HomeHelp';
import { HomeSkeleton } from './components/HomeSkeleton';
import { styles } from './Home.styles';
import { useGradesFocus } from './useGradesFocus';

type ErrorControl = {
  key: string;
  label: string;
  callback: () => unknown;
};

type ClassesSheet = { visible: boolean; focusId: string | null };

const NOT_STARTED_TEXT = 'Parece que o período não se iniciou ainda.';

export const HomePage = () => {
  const [classesSheet, setClassesSheet] = useState<ClassesSheet>({
    visible: false,
    focusId: null,
  });
  const [refreshing, setRefreshing] = useState(false);
  const now = useNow();

  const { account } = useIdentity();
  const online = useOnlineStatus();
  const scheduleQuery = useSchedule();
  const gradesQuery = useGrades();
  const ridQuery = usePartialRid();
  const {
    isLoading: loadingSchedule,
    error: scheduleError,
    refetch: scheduleRefresh,
  } = scheduleQuery;
  const {
    isLoading: loadingGrades,
    error: gradesError,
    refetch: gradesRefresh,
  } = gradesQuery;
  const {
    data: partialRID,
    isLoading: loadingRID,
    error: ridError,
    refetch: ridRefresh,
  } = ridQuery;
  const currentSchedule = scheduleQuery.data ?? [];
  const classGrades = gradesQuery.data ?? [];
  const isClassGradesAvailable = classGrades.some(({ grades }) =>
    Object.values(grades).some(
      grade => typeof grade === 'number' && Number.isFinite(grade),
    ),
  );
  const isBlocked = [scheduleError, gradesError, ridError].some(
    isPortalBlocked,
  );
  const { scrollRef, onGradesLayout } = useGradesFocus({
    available: isClassGradesAvailable,
    settled: !loadingGrades,
  });
  const firstName = parseName(account?.name ?? '', true).split(' ')[0] ?? '';
  const period =
    account?.period && account.period !== 'current'
      ? account.period
      : undefined;

  const isLoading = loadingSchedule || loadingGrades || loadingRID;
  const isPaused =
    !online ||
    scheduleQuery.isPaused ||
    gradesQuery.isPaused ||
    ridQuery.isPaused;

  const isScheduleAvailable = currentSchedule?.length > 0;
  const isPartialRidAvailable = partialRID && partialRID?.subjects?.length > 0;

  const hasSomethingAvailable =
    isClassGradesAvailable || isPartialRidAvailable || isScheduleAvailable;

  const errors: ErrorControl[] = [];

  const isScheduleWithError = Boolean(scheduleError && !isScheduleAvailable);
  if (isScheduleWithError) {
    errors.push({
      key: 'SCHEDULE',
      label: 'Grade de Horários',
      callback: scheduleRefresh,
    });
  }

  const isGradesWithError = Boolean(gradesError && !isClassGradesAvailable);
  if (isGradesWithError) {
    errors.push({
      key: 'GRADES',
      label: 'Quadro de notas',
      callback: gradesRefresh,
    });
  }

  const isRIDWithError = Boolean(ridError && !isPartialRidAvailable);
  if (isRIDWithError && !isScheduleAvailable) {
    errors.push({
      key: 'RID',
      label: 'RID Parcial',
      callback: ridRefresh,
    });
  }

  const hasAnyError = errors.length > 0;
  const hasTooManyErrors = errors.length >= 2;
  const errorText = `Ops, parece que houve um erro nos seguintes componentes: ${errors
    .map(e => e.label)
    .join(', ')}. Toque aqui para tentar novamente.`;

  const errorsCallback = () => {
    void Promise.all(errors.map(e => e.callback()));
  };

  const queries = [scheduleQuery, gradesQuery, ridQuery];
  /** Tenta de novo tudo o que falhou (com ou sem dados salvos). */
  const retryFailed = () => {
    void Promise.all(queries.filter(q => q.error).map(q => q.refetch()));
  };
  const refetchAll = async () =>
    await Promise.all(queries.map(q => q.refetch()));

  const onRefresh = () => {
    // Sem conexão o React Query pausa as consultas e o refetch só termina
    // quando a rede volta: dispara sem esperar e deixa o aviso do topo explicar.
    if (!online) {
      void refetchAll();
      return;
    }
    setRefreshing(true);
    // `.finally` da promessa: o React Compiler 1.0 não compila try/finally.
    void refetchAll().finally(() => setRefreshing(false));
  };

  const openClasses = useCallback((item?: AttendedClassesSchedule) => {
    setClassesSheet({ visible: true, focusId: item?.class?.id ?? null });
  }, []);
  const closeClasses = useCallback(() => {
    setClassesSheet(sheet => ({ ...sheet, visible: false }));
  }, []);

  const greeting = <HomeGreeting firstName={firstName} date={dateLabel(now)} />;

  if (isBlocked && !hasSomethingAvailable) {
    return (
      <ScreenPanel>
        <RemoteNotices style={styles.notice} />
        {greeting}
        <BlockedState onRetry={retryFailed} />
      </ScreenPanel>
    );
  }

  // Um único aviso de estado no topo (e não um por consulta): sem conexão,
  // portal bloqueado, falha ao atualizar ou a barra de "atualizando".
  const withData = queries.filter(q => q.data !== undefined);
  const updatedAts = withData.map(q => q.dataUpdatedAt).filter(Boolean);
  const oldestUpdate = updatedAts.length ? Math.min(...updatedAts) : undefined;
  const failedWithData = withData.find(q => q.error);
  let notice: React.ReactNode;
  if (isPaused) {
    notice = (
      <QueryNotice
        isPaused
        isFetching={false}
        error={null}
        hasData={withData.length > 0}
        dataUpdatedAt={oldestUpdate}
        retry={refetchAll}
      />
    );
  } else if (isBlocked) {
    notice = (
      <Notice kind="blocked" onRetry={retryFailed} style={styles.notice} />
    );
  } else {
    notice = (
      <QueryNotice
        isPaused={false}
        isFetching={!refreshing && withData.some(q => q.isFetching)}
        error={failedWithData?.error ?? null}
        hasData={withData.length > 0}
        dataUpdatedAt={failedWithData?.dataUpdatedAt || oldestUpdate}
        retry={failedWithData ? failedWithData.refetch : refetchAll}
      />
    );
  }

  const showSkeleton = !hasSomethingAvailable && isLoading;
  const showError = hasAnyError && !isLoading;
  const showNotStarted =
    !hasSomethingAvailable && !hasAnyError && !isLoading && !isPaused;

  return (
    <>
      <AppInfoModal />
      <ScreenPanel
        refreshing={refreshing && !isPaused}
        onRefresh={onRefresh}
        scrollRef={scrollRef}
      >
        <RemoteNotices style={styles.notice} />
        {notice}
        {greeting}
        {showSkeleton ? <HomeSkeleton /> : null}
        {showError ? (
          <>
            <ErrorState
              variant="card"
              message={errorText}
              onRetry={errorsCallback}
              style={styles.errorCard}
            />
            {hasTooManyErrors ? <HomeHelp /> : null}
          </>
        ) : null}
        {showNotStarted ? (
          <EmptyState icon="event_upcoming" text={NOT_STARTED_TEXT} />
        ) : null}
        {isScheduleAvailable ? (
          <>
            <NextClassCard
              data={currentSchedule}
              now={now}
              onPress={openClasses}
            />
            <ReminderPrompt style={styles.prompt} />
          </>
        ) : null}
        {isClassGradesAvailable ? (
          <View onLayout={onGradesLayout} testID="home-grades">
            <GradeBoard data={classGrades} period={period} />
          </View>
        ) : null}
        <ClassScheduleBoard
          data={currentSchedule}
          now={now}
          onSubjectPress={openClasses}
        />
        {!isScheduleAvailable && isPartialRidAvailable ? (
          <RIDBoard data={partialRID} />
        ) : null}
      </ScreenPanel>
      <AttendedClassesBoard
        visible={classesSheet.visible}
        focusId={classesSheet.focusId}
        onClose={closeClasses}
        data={currentSchedule}
      />
    </>
  );
};
