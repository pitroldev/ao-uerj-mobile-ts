import React from 'react';
import { Linking } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';
import type { Message } from '@root/modules/community/domain/models';
import Box from '@atoms/Box';
import Text from '@atoms/Text';
import { Row, ChatText, TouchableButton } from './ChatBubble.styles';

const ChatBubble = ({ createdAt, text, authorName }: Message) => {
  const date = new Date(createdAt);
  const copyToClipboard = () => {
    Clipboard.setString(text);
    Toast.show({
      type: 'success',
      text1: 'Copiado com sucesso!',
      text2: 'O texto foi copiado para a área de transferência.',
    });
  };
  const openLink = (url: string) => {
    if (!/^https?:\/\//i.test(url)) return;
    void Linking.openURL(url).catch(() =>
      Toast.show({ type: 'error', text1: 'Não foi possível abrir este link.' }),
    );
  };
  return (
    <TouchableButton onPress={copyToClipboard}>
      <Box>
        <Row>
          <Text size="XS" weight="bold">
            {authorName}
          </Text>
          <Text size="XS" italic>{`${date.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })} - ${date.toLocaleDateString('pt-BR')}`}</Text>
        </Row>
        <ChatText onPress={openLink}>
          <Text size="XS">{text}</Text>
        </ChatText>
      </Box>
    </TouchableButton>
  );
};

export default ChatBubble;
