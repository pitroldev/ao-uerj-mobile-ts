import React, {useState} from 'react';

import {useAppSelector} from '@root/store';
import * as infoReducer from '@reducers/userInfo';
import * as attendedReducer from '@features/AttendedClassesSchedule/reducer';
import * as gradesReducer from '@features/ClassGrades/reducer';

import parser from '@services/parser';
import useUerjFetch from '@hooks/useUerjFetch';
import {fetchPartialRID} from '@features/PartialRID/fetchPartialRID';
import {fetchClassGrades} from '@features/ClassGrades/fetchClassGrades';
import {fetchAttendedClassesSchedule} from '@features/AttendedClassesSchedule/fetchAttendedClassesSchedule';

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

  const {loading: loadingSchedule} = useUerjFetch(fetchAttendedClassesSchedule);
  const {loading: loadingGrades} = useUerjFetch(fetchClassGrades);
  const {loading: loadingRID, data: partialRID} =
    useUerjFetch<PartialRidData>(fetchPartialRID);

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
