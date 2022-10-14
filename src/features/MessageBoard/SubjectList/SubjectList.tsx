import React from 'react';
import {TouchableOpacity} from 'react-native';

import {useAppSelector} from '@root/store';
import * as infoReducer from '@reducers/userInfo';

import {AttendedSubjectInfo} from '@features/AttendedClassesSchedule/types';
import * as classesReducer from '@features/AttendedClassesSchedule/reducer';

import SubjectBox from '@molecules/SubjectBox';
import {Container} from './SubjectList.styles';
import DummyMessage from '@root/components/molecules/DummyMessage';

type Props = {
  onSubjectPress: (item: AttendedSubjectInfo) => void;
};

const SubjectList = ({onSubjectPress}: Props) => {
  const {periodo} = useAppSelector(infoReducer.selectUserInfo);
  const {data: classScheduleData} = useAppSelector(
    classesReducer.selectAttendedClasses,
  );

  const classesSchedule = classScheduleData?.[periodo as string] ?? [];

  const subjects = classesSchedule.reduce((acc, c) => {
    const alreadyHasSubject = acc.some(s => s.id === c.class.id);
    const isActive = c.class.status !== 'CANCELED';
    if (!alreadyHasSubject && isActive) {
      acc.push(c.class);
    }
    return acc;
  }, [] as AttendedSubjectInfo[]);

  const renderItem = (item: AttendedSubjectInfo) => (
    <TouchableOpacity key={item.id} onPress={() => onSubjectPress(item)}>
      <SubjectBox
        key={item.id}
        topLeftInfo={item.id}
        name={item.name}
        boldOptions={{topLeft: true}}
      />
    </TouchableOpacity>
  );

  if (subjects.length === 0) {
    return (
      <DummyMessage
        type="EMPTY"
        text="Parece que você não está inscrito em nenhuma disciplina no momento."
      />
    );
  }

  return <Container>{subjects.map(renderItem)}</Container>;
};

export default SubjectList;
