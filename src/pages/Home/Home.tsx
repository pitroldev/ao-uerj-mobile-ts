import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';
import { parseName } from '@services/parser';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
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
import { toIsoDate } from '@root/modules/attendance/domain/attendance';
import { useAttendance } from '@root/modules/attendance/presentation/useAttendance';
import {
  isSettled,
  type Evaluation,
  type ExamType,
} from '@root/modules/evaluations/domain/evaluations';
import { gradesBySubject } from '@root/modules/evaluations/presentation/scheduleLookup';
import { useEvaluations } from '@root/modules/evaluations/presentation/useEvaluations';
import type {
  AttendedClassesSchedule,
  AttendedSubjectInfo,
} from '@root/modules/academics/domain/models';

import { ScreenPanel } from '@templates/ScreenPanel';
import { BlockedState, EmptyState, ErrorState, Notice } from '@components/ui';

import { AppInfoModal } from '@features/AppInfoModal';
import { RIDBoard } from '@features/PartialRID/RIDBoard';
import { GradeBoard } from '@features/ClassGrades/GradeBoard';
import { NextClassCard } from '@features/AttendedClassesSchedule/NextClassCard';
import { ClassScheduleBoard } from '@features/AttendedClassesSchedule/ClassScheduleBoard';
import { AttendedClassesBoard } from '@features/AttendedClassesSchedule/AttendedClassesBoard';
import { AttendanceSheet } from '@features/AttendedClassesSchedule/AttendanceSheet';
import {
  EvaluationSheet,
  type EvaluationRequest,
} from '@features/Evaluations/EvaluationSheet';
import { UpcomingEvaluations } from '@features/Evaluations/UpcomingEvaluations';
import {
  dateLabel,
  hasClassTime,
} from '@features/AttendedClassesSchedule/scheduleFormat';
import { UntimedClasses } from '@features/AttendedClassesSchedule/UntimedClasses';
import {
  isCurrentPartialRid,
  isPastPartialRid,
} from '@root/modules/academics/domain/rules/partialRid';
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

/** A folha da avaliação; `key` muda a cada abertura e recomeça o formulário. */
type EvaluationState = {
  visible: boolean;
  key: number;
  request: EvaluationRequest | null;
};

type AttendanceState = {
  visible: boolean;
  subject: AttendedSubjectInfo | null;
  /** Aula tocada na agenda, com a pergunta "Você foi a esta aula?". */
  focus: { date: string; start: number } | null;
};

const NOT_STARTED_TEXT = 'Parece que o período não se iniciou ainda.';
/** Com um RID de inscrição já encerrada, o período começou: a grade é que veio vazia. */
const NO_CLASSES_TEXT =
  'O Aluno Online não lista disciplinas em curso para você.';

export const HomePage = () => {
  const [classesSheet, setClassesSheet] = useState<ClassesSheet>({
    visible: false,
    focusId: null,
  });
  const [attendance, setAttendance] = useState<AttendanceState>({
    visible: false,
    subject: null,
    focus: null,
  });
  // "Faltas" em Disciplinas em Curso: a folha das faltas só abre depois que
  // a outra termina de descer (no iOS, um modal não abre enquanto outro sai)
  const pendingAttendance = useRef<AttendedSubjectInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [evaluationSheet, setEvaluationSheet] = useState<EvaluationState>({
    visible: false,
    key: 0,
    request: null,
  });
  const now = useNow();
  const { keys: absenceKeys } = useAttendance();
  const { evaluations } = useEvaluations();
  const { notifications } = useAppServices();
  // "Já fiz" tocado na barra com o app aberto não muda o AppState: a cada
  // minuto do relógio da tela, o Início lê o que o aparelho guardou
  useEffect(() => {
    void notifications.consumeDone();
  }, [notifications, now]);

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
  // a nota manda: a prova com nota (ou a PF que deixou de existir) sai da
  // semana e da próxima aula; o quadro de notas tem a regra própria
  const openEvaluations = useMemo(() => {
    const grades = gradesBySubject(classGrades);
    return evaluations.filter(item => !isSettled(item, grades));
  }, [evaluations, classGrades]);
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
    // sem rede ou com erro, "Sem notas no período" seria mentira: espera
    settled: gradesQuery.isSuccess,
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
  const hasTimedClasses = currentSchedule.some(hasClassTime);
  const isPartialRidAvailable = isCurrentPartialRid(partialRID, now);
  const hasPastRid = isPastPartialRid(partialRID, now);

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
    pendingAttendance.current = null;
    setClassesSheet({ visible: true, focusId: item?.class?.id ?? null });
  }, []);
  const closeClasses = useCallback(() => {
    setClassesSheet(sheet => ({ ...sheet, visible: false }));
  }, []);
  const openEndedClass = useCallback(
    (item: AttendedClassesSchedule, date: Date) => {
      setAttendance({
        visible: true,
        subject: item.class,
        focus: { date: toIsoDate(date), start: item.start_time_in_minutes },
      });
    },
    [],
  );
  const queueAttendance = useCallback((subject: AttendedSubjectInfo) => {
    pendingAttendance.current = subject;
  }, []);
  const classesClosed = useCallback(() => {
    const subject = pendingAttendance.current;
    pendingAttendance.current = null;
    if (subject) setAttendance({ visible: true, subject, focus: null });
  }, []);
  const closeAttendance = useCallback(() => {
    setAttendance(sheet => ({ ...sheet, visible: false }));
  }, []);
  const openEvaluation = useCallback((request: EvaluationRequest) => {
    setEvaluationSheet(sheet => ({
      visible: true,
      key: sheet.key + 1,
      request,
    }));
  }, []);
  const editEvaluation = useCallback(
    (evaluation: Evaluation) =>
      openEvaluation({ kind: 'edit', id: evaluation.id }),
    [openEvaluation],
  );
  const annotateExam = useCallback(
    (subjectId: string, type: ExamType) =>
      openEvaluation({ kind: 'new', subjectId, type }),
    [openEvaluation],
  );
  const annotateOn = useCallback(
    (date: string) => openEvaluation({ kind: 'new', date }),
    [openEvaluation],
  );
  const closeEvaluation = useCallback(() => {
    setEvaluationSheet(sheet => ({ ...sheet, visible: false }));
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
          <EmptyState
            icon="event_upcoming"
            text={hasPastRid ? NO_CLASSES_TEXT : NOT_STARTED_TEXT}
          />
        ) : null}
        {hasTimedClasses ? (
          <>
            <NextClassCard
              data={currentSchedule}
              now={now}
              onPress={openClasses}
              evaluations={openEvaluations}
            />
            <ReminderPrompt style={styles.prompt} />
          </>
        ) : null}
        {isScheduleAvailable ? (
          <UpcomingEvaluations
            evaluations={evaluations}
            schedule={currentSchedule}
            grades={classGrades}
            now={now}
            onAdd={() => openEvaluation({ kind: 'new' })}
            onPress={editEvaluation}
          />
        ) : null}
        {isClassGradesAvailable ? (
          <View onLayout={onGradesLayout} testID="home-grades">
            <GradeBoard
              data={classGrades}
              period={period}
              evaluations={evaluations}
              onAnnotate={annotateExam}
              onEvaluationPress={editEvaluation}
            />
          </View>
        ) : null}
        <ClassScheduleBoard
          data={currentSchedule}
          now={now}
          onSubjectPress={openClasses}
          absences={absenceKeys}
          onEndedClassPress={openEndedClass}
          period={period}
          evaluations={openEvaluations}
          onEvaluationPress={editEvaluation}
          onAddEvaluation={annotateOn}
        />
        <UntimedClasses data={currentSchedule} onSubjectPress={openClasses} />
        {!isScheduleAvailable && isPartialRidAvailable && partialRID ? (
          <RIDBoard data={partialRID} />
        ) : null}
      </ScreenPanel>
      <AttendedClassesBoard
        visible={classesSheet.visible}
        focusId={classesSheet.focusId}
        onClose={closeClasses}
        onClosed={classesClosed}
        data={currentSchedule}
        onAttendancePress={queueAttendance}
      />
      <AttendanceSheet
        visible={attendance.visible}
        onClose={closeAttendance}
        subject={attendance.subject}
        data={currentSchedule}
        focus={attendance.focus}
        now={now}
      />
      {evaluationSheet.request ? (
        <EvaluationSheet
          key={evaluationSheet.key}
          visible={evaluationSheet.visible}
          request={evaluationSheet.request}
          onClose={closeEvaluation}
          schedule={currentSchedule}
          grades={classGrades}
          now={now}
        />
      ) : null}
    </>
  );
};
