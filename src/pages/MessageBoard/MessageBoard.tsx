import React, { useState } from 'react';

import { useBackHandler } from '@hooks/useBackHandler';

import { AttendedSubjectInfo } from '@features/AttendedClassesSchedule/types';
import SubjectList from '@features/MessageBoard/SubjectList';
import SubjectChat from '@features/MessageBoard/SubjectChat';

import Text from '@atoms/Text';

import { MainContainer } from './MessageBoard.styles';

const MessageBoard = () => {
  const [subject, setSubject] = useState<AttendedSubjectInfo | null>(null);

  useBackHandler(() => setSubject(null));

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
