import React, { useState } from 'react';

import { useBackHandler } from '@hooks/useBackHandler';
import { useHeaderBack } from '@templates/Header/headerStore';

import type { AttendedSubjectInfo } from '@root/modules/academics/domain/models';
import SubjectList from '@features/MessageBoard/SubjectList';
import SubjectChat from '@features/MessageBoard/SubjectChat';

/**
 * Mural de Mensagens: lista das disciplinas em curso e, ao tocar numa delas,
 * a conversa da turma. A seta do cabeçalho e o voltar do Android fecham a
 * conversa.
 */
const MessageBoard = () => {
  const [subject, setSubject] = useState<AttendedSubjectInfo | null>(null);
  const closeChat = () => setSubject(null);

  useBackHandler(closeChat, Boolean(subject));
  useHeaderBack(subject ? closeChat : null, 'Voltar para as disciplinas');

  if (subject) {
    return <SubjectChat {...subject} />;
  }

  return <SubjectList onSubjectPress={setSubject} />;
};

export default MessageBoard;
