import React, {useState} from 'react';
import {BackHandler} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';

import {AttendedSubjectInfo} from '@features/AttendedClassesSchedule/types';
import SubjectList from '@features/MessageBoard/SubjectList';

import Text from '@atoms/Text';

import {MainContainer} from './MessageBoard.styles';
import SubjectChat from '@root/features/MessageBoard/SubjectChat';

const MessageBoard = () => {
  const [subject, setSubject] = useState<AttendedSubjectInfo | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        setSubject(null);
        return true;
      };
      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () =>
        BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, []),
  );

  if (subject) {
    return (
      <MainContainer>
        <SubjectChat {...subject} />
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <Text weight="bold" marginLeft="16px" marginBottom="2px">
        Disciplinas em Curso
      </Text>
      <SubjectList onSubjectPress={setSubject} />
    </MainContainer>
  );
};

export default MessageBoard;
