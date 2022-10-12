import React from 'react';
import {Linking} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

import parser from '@services/parser';

import {ChatMessage} from '@features/MessageBoard/types';

import Box from '@atoms/Box';
import Text from '@atoms/Text';

import {Row, ChatText, TouchableButton} from './ChatBubble.styles';

const ChatBubble = (item: ChatMessage) => {
  const {createdAt, message, fullName} = item;

  const date = new Date(createdAt);
  const parsedName = parser.parseName(fullName, false);

  const copyToClipboard = () => {
    Clipboard.setString(message);
  };

  return (
    <TouchableButton onPress={copyToClipboard}>
      <Box>
        <Row>
          <Text size="XS" weight="bold">
            {parsedName}
          </Text>
          <Text
            size="XS"
            italic>{`${date.getHours()}:${date.getMinutes()} - ${date.toLocaleDateString()}`}</Text>
        </Row>
        <ChatText
          onPress={(url: string) => {
            Linking.openURL(url).catch((err: Error) => console.log('err', err));
          }}>
          <Text size="XS">{message}</Text>
        </ChatText>
      </Box>
    </TouchableButton>
  );
};

export default ChatBubble;
