import React, { useState } from 'react';
import { useTheme } from 'styled-components/native';
import Toast from 'react-native-toast-message';
import { FontAwesome as Icon } from '@react-native-vector-icons/fontawesome';
import { Picker } from '@react-native-picker/picker';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { errorMessage, isTransientError } from '@root/shared/errors/AppError';
import ChatBubble from '@features/MessageBoard/ChatBubble';
import type { AttendedSubjectInfo } from '@root/modules/academics/domain/models';
import { communityKeys } from '@root/modules/community/presentation/queryKeys';
import { MAX_MESSAGE_LENGTH } from '@root/modules/community/domain/models';
import Text from '@atoms/Text';
import Spinner from '@atoms/Spinner';
import TextArea from '@atoms/TextArea';
import StyledPicker from '@atoms/Picker';
import RoundedButton from '@atoms/RoundedButton';
import DummyMessage from '@molecules/DummyMessage';
import { Row, InputRow, ScrollView } from './SubjectChat.styles';

const SubjectChat = (subject: AttendedSubjectInfo) => {
  const [text, setText] = useState('');
  const { community } = useAppServices();
  const { account } = useIdentity();
  const { COLORS } = useTheme();
  const now = new Date();
  const suggestedPeriod = `${now.getFullYear()}.${
    now.getMonth() < 6 ? '1' : '2'
  }`;
  const portalHasPeriod = /^\d{4}\.[12]$/.test(account?.period ?? '');
  const [period, setPeriod] = useState(
    portalHasPeriod ? account!.period : suggestedPeriod,
  );
  const periodOptions = [
    ...new Set([
      period,
      ...Array.from({ length: 6 }, (_, index) => {
        const year = now.getFullYear() - Math.floor(index / 2);
        return `${year}.${index % 2 === 0 ? '2' : '1'}`;
      }),
    ]),
  ]
    .sort()
    .reverse();
  const thread = {
    subjectId: subject.id,
    classNumber: String(subject.class),
    period,
  };
  const query = useQuery({
    queryKey: communityKeys.messages(account?.scope ?? 'signed-out', thread),
    queryFn: ({ signal }) => community.messages(thread, { signal }),
    enabled: Boolean(account),
    retry: (count, error) => count < 1 && isTransientError(error),
  });
  const { mutate, isPending: sending } = useMutation({
    mutationFn: (messageText: string) =>
      community.postMessage(thread, messageText),
    onSuccess: () => {
      setText('');
      void query.refetch();
    },
    onError: error => Toast.show({ type: 'error', text1: errorMessage(error) }),
  });
  const handleSendMessage = () => {
    if (text.trim() && !sending) mutate(text);
  };
  const messages = query.data ?? [];

  return (
    <>
      <Row>
        <Text weight="bold">{subject.name}</Text>
        <Text size="XS" italic>
          Turma {subject.class ?? '(?)'}
        </Text>
      </Row>
      <Text size="XS">
        Período das mensagens
        {portalHasPeriod ? '' : ' — sugestão pelo calendário; confirme abaixo'}
      </Text>
      <StyledPicker
        selectedValue={period}
        onValueChange={value => setPeriod(String(value))}
        enabled={!sending}
      >
        {periodOptions.map(value => (
          <Picker.Item key={value} value={value} label={value} />
        ))}
      </StyledPicker>
      <ScrollView>
        {query.isLoading && <Spinner loading size="large" />}
        {!!query.error && (
          <DummyMessage
            type="ERROR"
            text={errorMessage(query.error)}
            onPress={() => {
              void query.refetch();
            }}
          />
        )}
        {!query.isLoading && !query.error && messages.length === 0 && (
          <DummyMessage
            type="INFO"
            text="Compartilhe informações da turma, como grupos, links, materiais e datas de prova."
          />
        )}
        {messages.map(message => (
          <ChatBubble {...message} key={message.id} />
        ))}
      </ScrollView>
      <InputRow>
        <TextArea
          multiline
          onChangeText={setText}
          value={text}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Digite aqui sua mensagem"
          editable={!sending}
          onSubmitEditing={handleSendMessage}
        />
        <RoundedButton
          onPress={handleSendMessage}
          loading={sending}
          disabled={!text.trim()}
        >
          <Icon name="send" color={COLORS.BACKGROUND} size={25} />
        </RoundedButton>
      </InputRow>
    </>
  );
};

export default SubjectChat;
