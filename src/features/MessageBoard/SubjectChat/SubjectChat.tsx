import React, {useState} from 'react';
import Icon from 'react-native-vector-icons/FontAwesome';

import {useAppSelector} from '@root/store';
import * as infoReducer from '@reducers/userInfo';

import {fetchMessages, postMessage} from '@features/MessageBoard/core';
import {ChatMessage} from '@features/MessageBoard/types';
import ChatBubble from '@features/MessageBoard/ChatBubble';
import {AttendedSubjectInfo} from '@features/AttendedClassesSchedule/types';

import useUerjFetch from '@hooks/useUerjFetch';

import Text from '@atoms/Text';
import Spinner from '@atoms/Spinner';
import RoundedButton from '@atoms/RoundedButton';
import {
  InputContainer,
  Row,
  InputRow,
  TextArea,
  ScrollView,
} from './SubjectChat.styles';

const SubjectChat = (subject: AttendedSubjectInfo) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const {name, periodo} = useAppSelector(infoReducer.selectUserInfo);

  const {data, error, loading, setData} = useUerjFetch<ChatMessage[]>(
    async () => await fetchMessages(subject.id, subject.class),
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
    return null; //TODO Show Dummy
  }

  const isEmpty = data.length === 0;

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
        {isEmpty && <Text>INSERIR DUMMY</Text>}
        {data.map(props => (
          <ChatBubble {...props} key={props._id} />
        ))}
      </ScrollView>
      <InputRow>
        <InputContainer showsVerticalScrollIndicator={false}>
          <TextArea
            multiline
            onChangeText={setText}
            value={text}
            placeholder="Digite aqui sua mensagem"
            editable={!sending}
            onSubmitEditing={handleSendMessage}
          />
        </InputContainer>
        <RoundedButton onPress={handleSendMessage} loading={sending}>
          <Icon name={'send'} color={'#FFF'} size={25} />
        </RoundedButton>
      </InputRow>
    </>
  );
};

export default SubjectChat;
