import React, { useState } from 'react';
import { useTheme } from 'styled-components';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useQuery, useMutation } from 'react-query';

import { useAppSelector } from '@root/store';
import * as infoReducer from '@reducers/userInfo';

import { fetchMessages, postMessage } from '@features/MessageBoard/core';
import { ChatMessage } from '@features/MessageBoard/types';
import ChatBubble from '@features/MessageBoard/ChatBubble';
import { AttendedSubjectInfo } from '@features/AttendedClassesSchedule/types';

import Text from '@atoms/Text';
import Spinner from '@atoms/Spinner';
import TextArea from '@atoms/TextArea';
import RoundedButton from '@atoms/RoundedButton';
import DummyMessage from '@molecules/DummyMessage';

import { Row, InputRow, ScrollView } from './SubjectChat.styles';

const SubjectChat = (subject: AttendedSubjectInfo) => {
  const [text, setText] = useState('');

  const { name, periodo } = useAppSelector(infoReducer.selectUserInfo);

  const { COLORS } = useTheme();

  const {
    data,
    error,
    isFetching: loading,
    refetch,
  } = useQuery({
    queryKey: ['private-class-messages', periodo, subject],
    queryFn: () => fetchMessages(subject.id, subject.class),
    initialData: [] as ChatMessage[],
  });

  const { mutate, isLoading: sending } = useMutation({
    mutationFn: postMessage,
    onSuccess: (newMessage: ChatMessage) => {
      setText('');
      data?.unshift(newMessage);
      refetch();
    },
    onError: () => {
      Toast.show({
        type: 'error',
        text1: 'Ops, ocorreu um erro :(',
        text2:
          'Não foi possível enviar a sua mensagem, tente novamente mais tarde.',
      });
    },
  });

  const handleSendMessage = async () => {
    if (!text.trim()) {
      return;
    }

    mutate({
      fullName: name,
      disciplina: subject.id,
      turma: subject.class,
      periodo,
      message: text.trim(),
    });
  };

  if (error || !data) {
    return (
      <DummyMessage
        type="ERROR"
        text="Ops, parece que houve um erro ao buscar as mensagens da turma. Toque aqui para tentar novamente."
        onPress={fetch}
      />
    );
  }

  const isEmpty = !loading && data.length === 0;

  return (
    <>
      <Row>
        <Text weight="bold">{subject.name}</Text>
        <Text size="XS" italic>
          Turma {subject.class ?? '(?)'}
        </Text>
      </Row>
      <ScrollView>
        {loading && <Spinner loading size="large" />}
        {isEmpty && (
          <DummyMessage
            type="INFO"
            text="Este espaço foi criado para alunos compartilharem informações importantes da turma de forma segura, como por exemplo: grupos, links, materiais, datas de prova etc."
          />
        )}
        {data.map(props => (
          <ChatBubble {...props} key={props._id} />
        ))}
      </ScrollView>
      <InputRow>
        <TextArea
          multiline
          onChangeText={setText}
          value={text}
          placeholder="Digite aqui sua mensagem"
          editable={!sending}
          onSubmitEditing={handleSendMessage}
        />
        <RoundedButton onPress={handleSendMessage} loading={sending}>
          <Icon name={'send'} color={COLORS.BACKGROUND} size={25} />
        </RoundedButton>
      </InputRow>
    </>
  );
};

export default SubjectChat;
