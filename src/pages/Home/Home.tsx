import React from 'react';

import {useAppSelector} from '@root/store';
import * as infoReducer from '@reducers/userInfo';
import * as attendedReducer from '@reducers/attendedClasses';

import parser from '@services/parser';
import useUerjFetch from '@hooks/useUerjFetch';
import {fetchAttendedClassesSchedule} from '@features/api/fetchAttendedClassesSchedule';

import Text from '@atoms/Text';
import ClassScheduleBoard from '@templates/ClassScheduleBoard';

import {MainContainer} from './Home.styles';

const HomePage = () => {
  const {loading: loadingSchedule} = useUerjFetch(fetchAttendedClassesSchedule);

  const {periodo, name} = useAppSelector(infoReducer.selectUserInfo);
  const {data: attendedClassesData} = useAppSelector(
    attendedReducer.selectAttendedClasses,
  );
  const currentSchedule = attendedClassesData?.[periodo as string];

  const parsedName = parser.parseName(name, false);
  return (
    <MainContainer>
      <Text weight="300" size="MD">
        Olá,
      </Text>
      <Text weight="bold" size="LG">
        {parsedName}
      </Text>
      <ClassScheduleBoard data={currentSchedule} />
    </MainContainer>
  );
};

export default HomePage;
