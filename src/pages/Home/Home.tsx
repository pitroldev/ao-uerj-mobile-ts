import React, { useState } from 'react';
import parser from '@services/parser';
import { useIdentity } from '@root/app/providers/AppServicesProvider';
import {
  useGrades,
  useSchedule,
  usePartialRid,
  isPortalBlocked,
} from '@root/modules/academics/presentation/queries';
import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import { useOnlineStatus } from '@root/modules/academics/presentation/useOnlineStatus';

import AppInfoModal from '@features/AppInfoModal';
import RIDBoard from '@features/PartialRID/RIDBoard';
import GradeBoard from '@features/ClassGrades/GradeBoard';
import ClassScheduleBoard from '@features/AttendedClassesSchedule/ClassScheduleBoard';
import AttendedClassesBoard from '@features/AttendedClassesSchedule/AttendedClassesBoard';

import Text from '@atoms/Text';
import Spinner from '@atoms/Spinner';
import DummyMessage from '@molecules/DummyMessage';
import SmallDummyMessage from '@molecules/SmallDummyMessage';

import {
  MainContainer,
  ScrollContainer,
  Row,
  Column,
  TooManyErrorsView,
  TooManyErrorsWarning,
  TooManyErrorsBulletItem,
  TooManyErrorsBulletDescription,
} from './Home.styles';

type ErrorControl = {
  key: string;
  label: string;
  callback: () => unknown;
};

const HomePage = () => {
  const [attendedModalVisibility, setAttendedModalVisibility] = useState(false);

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
  const parsedName = parser.parseName(account?.name ?? '', false);

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

  const errorsCallback = async () =>
    await Promise.all(errors.map(e => e.callback()));

  if (isBlocked && !hasSomethingAvailable) {
    return (
      <MainContainer>
        <Row>
          <Column>
            <Text weight="300" size="MD">
              Olá,
            </Text>
            <Text weight="bold" size="LG">
              {parsedName}
            </Text>
          </Column>
        </Row>
        <DummyMessage
          type="BLOCK"
          text="Parece que o Aluno Online está temporariamente bloqueado. Tente novamente mais tarde."
          onPress={errorsCallback}
        />
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <AppInfoModal />
      <Row>
        <Column>
          <Text weight="300" size="MD">
            Olá,
          </Text>
          <Text weight="bold" size="LG">
            {parsedName}
          </Text>
        </Column>
        {!hasSomethingAvailable && isLoading && (
          <Spinner loading size="large" />
        )}
      </Row>
      {hasTooManyErrors && (
        <TooManyErrorsView>
          <TooManyErrorsWarning>Caso o erro persista</TooManyErrorsWarning>
          <TooManyErrorsBulletItem>
            1. Verifique se o aplicativo está atualizado
          </TooManyErrorsBulletItem>
          <TooManyErrorsBulletItem>
            2. Saia e entre novamente no aplicativo
          </TooManyErrorsBulletItem>
          <TooManyErrorsBulletItem>
            3. Tente novamente mais tarde
          </TooManyErrorsBulletItem>
          <TooManyErrorsBulletDescription>
            As vezes a UERJ atualiza o sistema e isso pode causar problemas no
            aplicativo. Normalmente esses problemas são resolvidos em pouco
            tempo, mas caso continue vendo essa mensagem contate-nos pela página
            Sobre.
          </TooManyErrorsBulletDescription>
        </TooManyErrorsView>
      )}
      {isBlocked && (
        <SmallDummyMessage
          type="BLOCK"
          text="O Aluno Online está temporariamente bloqueado."
          onPress={errorsCallback}
        />
      )}
      {!hasSomethingAvailable && !hasAnyError && !isLoading && !isPaused && (
        <DummyMessage
          type="EMPTY"
          text="Parece que o período não se iniciou ainda."
        />
      )}
      <ScrollContainer>
        {[scheduleQuery, gradesQuery, ridQuery].map((query, index) => (
          <QueryNotice
            key={index}
            dataUpdatedAt={query.dataUpdatedAt}
            isPaused={query.isPaused}
            isFetching={query.isFetching}
            error={query.error}
            hasData={query.data !== undefined}
            retry={query.refetch}
          />
        ))}
        {isClassGradesAvailable && <GradeBoard data={classGrades} />}
        <ClassScheduleBoard
          data={currentSchedule}
          onSubjectPress={() => setAttendedModalVisibility(true)}
        />
        {!isScheduleAvailable && isPartialRidAvailable && (
          <RIDBoard data={partialRID} />
        )}
        <AttendedClassesBoard
          isVisible={attendedModalVisibility}
          setVisibility={setAttendedModalVisibility}
          data={currentSchedule}
        />
        {hasAnyError && !isLoading && (
          <DummyMessage
            type="ERROR"
            text={errorText}
            onPress={errorsCallback}
          />
        )}
      </ScrollContainer>
    </MainContainer>
  );
};

export default HomePage;
