import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';

import { useAppSelector } from '@root/store';

import parser from '@services/parser';

import { fetchPartialRID } from '@features/PartialRID/core';
import { fetchClassGrades } from '@features/ClassGrades/core';
import { fetchAttendedClassesSchedule } from '@features/AttendedClassesSchedule/core';

import * as infoReducer from '@reducers/userInfo';
import * as apiConfigReducer from '@reducers/apiConfig';
import * as gradesReducer from '@features/ClassGrades/reducer';
import * as attendedReducer from '@features/AttendedClassesSchedule/reducer';

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
  callback: () => any;
};

const HOUR_IN_MS = 1000 * 60 * 60;

const HomePage = () => {
  const [attendedModalVisibility, setAttendedModalVisibility] = useState(false);

  const dispatch = useDispatch();

  const { isBlocked, cookies, createdAt } = useAppSelector(
    apiConfigReducer.selectApiConfig,
  );
  const { periodo, name } = useAppSelector(infoReducer.selectUserInfo);
  const { data: attendedClassesData } = useAppSelector(
    attendedReducer.selectAttendedClasses,
  );
  const { data: classGrades, isClassGradesAvailable } = useAppSelector(
    gradesReducer.selectClassGrades,
  );

  const {
    data: attendedScheduleData,
    isLoading: loadingSchedule,
    error: scheduleError,
    refetch: scheduleRefresh,
  } = useQuery({
    queryKey: ['attended-classes-schedule', cookies, createdAt],
    queryFn: fetchAttendedClassesSchedule,
    staleTime: 12 * HOUR_IN_MS,
    enabled: Boolean(cookies),
    retry: 0,
  });

  useEffect(() => {
    if (attendedScheduleData) {
      dispatch(
        attendedReducer.setAttendedClasses({
          period: periodo as string,
          data: attendedScheduleData,
        }),
      );
    }
  }, [attendedScheduleData, dispatch, periodo]);

  const {
    data: gradesData,
    isLoading: loadingGrades,
    error: gradesError,
    refetch: gradesRefresh,
  } = useQuery({
    queryKey: ['class-grades', cookies, createdAt],
    queryFn: fetchClassGrades,
    staleTime: 6 * HOUR_IN_MS,
    enabled: Boolean(cookies),
    retry: 0,
  });

  useEffect(() => {
    if (gradesData) {
      dispatch(gradesReducer.setClassGrades(gradesData));
    }
  }, [gradesData, dispatch]);

  const {
    isLoading: loadingRID,
    data: partialRID,
    error: ridError,
    refetch: ridRefresh,
  } = useQuery({
    queryKey: ['partial-rid', cookies, createdAt],
    queryFn: fetchPartialRID,
    staleTime: 1 * HOUR_IN_MS,
    enabled: Boolean(cookies),
    retry: 0,
  });

  const currentSchedule = attendedClassesData?.[periodo as string];

  const parsedName = parser.parseName(name as string, false);

  const isLoading = loadingSchedule || loadingGrades || loadingRID;

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
      key: 'SCHEDULE',
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
            3. Desinstale e instale novamente o aplicativo
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
      {!hasSomethingAvailable && !hasAnyError && !isLoading && (
        <DummyMessage
          type="EMPTY"
          text="Parece que o período não se iniciou ainda."
        />
      )}
      <ScrollContainer>
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
