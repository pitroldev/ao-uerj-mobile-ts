import React, {useState} from 'react';

import {useAppSelector} from '@root/store';
import * as infoReducer from '@reducers/userInfo';

import parser from '@services/parser';
import useApiFetch from '@hooks/useApiFetch';

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

type PartialRidData = Awaited<ReturnType<typeof fetchPartialRID>>;

const HomePage = () => {
  const [attendedModalVisibility, setAttendedModalVisibility] = useState(false);

  const {
    loading: loadingSchedule,
    error: scheduleError,
    fetch: scheduleRefresh,
  } = useApiFetch(fetchAttendedClassesSchedule);

  const {
    loading: loadingGrades,
    error: gradesError,
    fetch: gradesRefresh,
  } = useApiFetch(fetchClassGrades);

  const {
    loading: loadingRID,
    data: partialRID,
    error: ridError,
    fetch: ridRefresh,
  } = useApiFetch<PartialRidData>(fetchPartialRID);

  const {periodo, name} = useAppSelector(infoReducer.selectUserInfo);
  const {isBlocked} = useAppSelector(apiConfigReducer.selectApiConfig);
  const {data: attendedClassesData} = useAppSelector(
    attendedReducer.selectAttendedClasses,
  );
  const {data: classGrades, isClassGradesAvailable} = useAppSelector(
    gradesReducer.selectClassGrades,
  );

  const currentSchedule = attendedClassesData?.[periodo as string];

  const parsedName = parser.parseName(name as string, false);

  const isLoading = loadingSchedule || loadingGrades || loadingRID;

  const isScheduleAvailable = currentSchedule?.length > 0;
  const isPartialRidAvailable = partialRID?.subjects?.length > 0;

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
