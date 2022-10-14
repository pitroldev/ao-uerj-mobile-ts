import React, {useState} from 'react';

import {useAppSelector} from '@root/store';
import * as infoReducer from '@reducers/userInfo';
import * as attendedReducer from '@features/AttendedClassesSchedule/reducer';
import * as gradesReducer from '@features/ClassGrades/reducer';

import parser from '@services/parser';
import useApiFetch from '@hooks/useApiFetch';
import {fetchPartialRID} from '@root/features/PartialRID/core';
import {fetchClassGrades} from '@root/features/ClassGrades/core';
import {fetchAttendedClassesSchedule} from '@root/features/AttendedClassesSchedule/core';

import Text from '@atoms/Text';
import Spinner from '@atoms/Spinner';
import ClassScheduleBoard from '@features/AttendedClassesSchedule/ClassScheduleBoard';
import GradeBoard from '@features/ClassGrades/GradeBoard';
import AttendedClassesBoard from '@features/AttendedClassesSchedule/AttendedClassesBoard';
import RIDBoard from '@features/PartialRID/RIDBoard';

import {MainContainer, ScrollContainer, Row, Column} from './Home.styles';

type PartialRidData = Awaited<ReturnType<typeof fetchPartialRID>>;

const HomePage = () => {
  const [attendedModalVisibility, setAttendedModalVisibility] = useState(false);

  const {loading: loadingSchedule} = useApiFetch(fetchAttendedClassesSchedule);
  const {loading: loadingGrades} = useApiFetch(fetchClassGrades);
  const {loading: loadingRID, data: partialRID} =
    useApiFetch<PartialRidData>(fetchPartialRID);

  const {periodo, name} = useAppSelector(infoReducer.selectUserInfo);
  const {data: attendedClassesData} = useAppSelector(
    attendedReducer.selectAttendedClasses,
  );
  const {data: classGrades, isClassGradesAvailable} = useAppSelector(
    gradesReducer.selectClassGrades,
  );

  const currentSchedule = attendedClassesData?.[periodo as string];

  const parsedName = parser.parseName(name, false);

  const isLoading = loadingSchedule || loadingGrades || loadingRID;
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
      <ScrollContainer>
        {isClassGradesAvailable && <GradeBoard data={classGrades} />}
        <ClassScheduleBoard
          data={currentSchedule}
          onSubjectPress={() => setAttendedModalVisibility(true)}
        />
        {partialRID && <RIDBoard data={partialRID} />}
        <AttendedClassesBoard
          isVisible={attendedModalVisibility}
          setVisibility={setAttendedModalVisibility}
          data={currentSchedule}
        />
      </ScrollContainer>
    </MainContainer>
  );
};

export default HomePage;
