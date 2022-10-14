import React, {useState} from 'react';
import {useTheme} from 'styled-components';
import Icon from 'react-native-vector-icons/FontAwesome';

import {useAppSelector} from '@root/store';
import * as infoReducer from '@reducers/userInfo';

import {fetchMessages, postMessage} from '@features/MessageBoard/core';
import {ChatMessage} from '@features/MessageBoard/types';
import ChatBubble from '@features/MessageBoard/ChatBubble';
import {AttendedSubjectInfo} from '@features/AttendedClassesSchedule/types';

import useApiFetch from '@hooks/useApiFetch';

import Text from '@atoms/Text';
import Spinner from '@atoms/Spinner';
import TextArea from '@atoms/TextArea';
import RoundedButton from '@atoms/RoundedButton';
import DummyMessage from '@molecules/DummyMessage';

import {Row, InputRow, ScrollView} from './SubjectChat.styles';

const SubjectChat = (subject: AttendedSubjectInfo) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const {name, periodo} = useAppSelector(infoReducer.selectUserInfo);

  const {COLORS} = useTheme();

  const {data, error, loading, setData} = useApiFetch<ChatMessage[]>(
    async () => await fetchMessages(subject.id, subject.class),
    {initialData: []},
  );

  const handleSendMessage = async () => {
    try {
      if (!text.trim()) {
        return;
      }

      setSending(true);

      const newMessage = await postMessage({
        fullName: name,
        disciplina: subject.id,
        turma: subject.class,
        periodo,
        message: text.trim(),
      });

      setData(c => [newMessage, ...c]);
      setText('');
    } catch (err) {
      console.log('sendMessage', err);
      // TODO Error notification
    } finally {
      setSending(false);
    }
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
