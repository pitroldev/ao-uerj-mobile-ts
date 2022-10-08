import React from 'react';

import {useAppSelector} from '@root/store';
import * as infoReducer from '@reducers/userInfo';
import * as attendedReducer from '@reducers/attendedClasses';
import * as gradesReducer from '@reducers/classGrades';

import parser from '@services/parser';
import useUerjFetch from '@hooks/useUerjFetch';
import {fetchClassGrades} from '@features/api/fetchClassGrades';
import {fetchAttendedClassesSchedule} from '@features/api/fetchAttendedClassesSchedule';

import Text from '@atoms/Text';
import ClassScheduleBoard from '@templates/ClassScheduleBoard';

import {MainContainer} from './Home.styles';
import GradeBoard from '@root/components/templates/GradeBoard';

const HomePage = () => {
  const {loading: loadingSchedule} = useUerjFetch(fetchAttendedClassesSchedule);
  const {loading: loadingGrades} = useUerjFetch(fetchClassGrades);

  const {periodo, name} = useAppSelector(infoReducer.selectUserInfo);
  const {data: attendedClassesData} = useAppSelector(
    attendedReducer.selectAttendedClasses,
  );
  const {data: classGrades, isClassGradesAvailable} = useAppSelector(
    gradesReducer.selectClassGrades,
  );

  const currentSchedule = attendedClassesData?.[periodo as string];

  const parsedName = parser.parseName(name, false);
  return (
    <MainContainer>
      <Text weight="300" size="MD" marginLeft="16px">
        Olá,
      </Text>
      <Text weight="bold" size="LG" marginLeft="16px">
        {parsedName}
      </Text>
      {isClassGradesAvailable && <GradeBoard data={classGrades} />}
      <ClassScheduleBoard data={currentSchedule} />
    </MainContainer>
  );
};

export default HomePage;
