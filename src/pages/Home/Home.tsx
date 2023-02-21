import React, {useState} from 'react';
import {useQuery} from 'react-query';
import {useDispatch} from 'react-redux';

import {useAppSelector} from '@root/store';
import * as infoReducer from '@reducers/userInfo';

import parser from '@services/parser';

import {fetchPartialRID} from '@features/PartialRID/core';
import {fetchClassGrades} from '@features/ClassGrades/core';
import {fetchAttendedClassesSchedule} from '@features/AttendedClassesSchedule/core';

import * as gradesReducer from '@features/ClassGrades/reducer';
import * as attendedReducer from '@features/AttendedClassesSchedule/reducer';
import * as apiConfigReducer from '@reducers/apiConfig';

import ClassScheduleBoard from '@features/AttendedClassesSchedule/ClassScheduleBoard';
import GradeBoard from '@features/ClassGrades/GradeBoard';
import AttendedClassesBoard from '@features/AttendedClassesSchedule/AttendedClassesBoard';
import RIDBoard from '@features/PartialRID/RIDBoard';

import Text from '@atoms/Text';
import Spinner from '@atoms/Spinner';
import DummyMessage from '@molecules/DummyMessage';
import SmallDummyMessage from '@molecules/SmallDummyMessage';

import {MainContainer, ScrollContainer, Row, Column} from './Home.styles';

type ErrorControl = {
  key: string;
  label: string;
  callback: () => any;
};

const HOUR_IN_MS = 1000 * 60 * 60;

const HomePage = () => {
  const [attendedModalVisibility, setAttendedModalVisibility] = useState(false);

  const dispatch = useDispatch();

  const {isBlocked} = useAppSelector(apiConfigReducer.selectApiConfig);
  const {periodo, name, matricula} = useAppSelector(infoReducer.selectUserInfo);
  const {data: attendedClassesData} = useAppSelector(
    attendedReducer.selectAttendedClasses,
  );
  const {data: classGrades, isClassGradesAvailable} = useAppSelector(
    gradesReducer.selectClassGrades,
  );

  const {
    isFetching: loadingSchedule,
    error: scheduleError,
    refetch: scheduleRefresh,
  } = useQuery({
    queryKey: ['attended-classes-schedule', periodo, matricula],
    queryFn: fetchAttendedClassesSchedule,
    staleTime: 12 * HOUR_IN_MS,
    onSuccess: data => {
      dispatch(
        attendedReducer.setAttendedClasses({
          period: periodo as string,
          data,
        }),
      );
    },
  });

  const {
    isFetching: loadingGrades,
    error: gradesError,
    refetch: gradesRefresh,
  } = useQuery({
    queryKey: ['class-grades', periodo, matricula],
    queryFn: fetchClassGrades,
    staleTime: 6 * HOUR_IN_MS,
    onSuccess: data => {
      dispatch(gradesReducer.setClassGrades(data));
    },
  });

  const {
    isFetching: loadingRID,
    data: partialRID,
    error: ridError,
    refetch: ridRefresh,
  } = useQuery({
    queryKey: ['partial-rid', periodo, matricula],
    queryFn: fetchPartialRID,
    staleTime: 1 * HOUR_IN_MS,
  });

  const currentSchedule = attendedClassesData?.[periodo as string];

  const parsedName = parser.parseName(name as string, false);

  const isLoading = loadingSchedule || loadingGrades || loadingRID;

  const isScheduleAvailable = currentSchedule?.length > 0;
  const isPartialRidAvailable = partialRID && partialRID?.subjects?.length > 0;

  const hasSomethingAvailable =
    isClassGradesAvailable || isPartialRidAvailable || isScheduleAvailable;

  const errors: ErrorControl[] = [];

  const isScheduleWithError = scheduleError && !isScheduleAvailable;
  if (isScheduleWithError) {
    errors.push({
      key: 'SCHEDULE',
      label: 'Grade de Horários',
      callback: scheduleRefresh,
    });
  }

  const isGradesWithError = gradesError && !isClassGradesAvailable;
  if (isGradesWithError) {
    errors.push({
      key: 'SCHEDULE',
      label: 'Quadro de notas',
      callback: gradesRefresh,
    });
  }

  const isRIDWithError = ridError && !isPartialRidAvailable;
  if (isRIDWithError && !isScheduleAvailable) {
    errors.push({
      key: 'RID',
      label: 'RID Parcial',
      callback: ridRefresh,
    });
  }

  const hasAnyError = errors.length > 0;
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
      <Row>
        <Column>
          <Text weight="300" size="MD">
            Olá,
          </Text>
          <Text weight="bold" size="LG">
            {parsedName}
          </Text>
        </Column>
        {isLoading && <Spinner loading size="large" />}
      </Row>
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
