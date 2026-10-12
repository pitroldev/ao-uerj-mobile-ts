import React, { useMemo } from 'react';
import {
  Linking,
  Text as RNText,
  type AccessibilityActionEvent,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';
import Hyperlink from 'react-native-hyperlink';
import { useTheme } from 'styled-components/native';

import type { Message } from '@root/modules/community/domain/models';
import { Text, typeStyle } from '@components/ui';

import { firstLink, messageDate, timeLabel } from '../chatFormat';
import { Author, Bubble, Head, Row } from './ChatBubble.styles';

type Props = {
  message: Message;
  /** Mensagem do próprio aluno: "Você", à direita, sobre o acento suave. */
  mine?: boolean;
};

const OPEN_LINK = 'openLink';

/** Balão de mensagem do mural. Tocar copia o texto; links abrem no navegador. */
const ChatBubble = ({ message, mine = false }: Props) => {
  const theme = useTheme();
  const { text, authorName, createdAt } = message;
  const time = timeLabel(messageDate(createdAt));
  const author = mine ? 'Você' : authorName;
  const link = firstLink(text);
  const linkStyle = useMemo(
    () => ({
      color: theme.colors.accent,
      textDecorationLine: 'underline' as const,
    }),
    [theme],
  );
  // mesmo estilo do `Text` variante `body`, tom tinta
  const bodyStyle = useMemo(
    () => [typeStyle(theme, 'body'), { color: theme.colors.ink }],
    [theme],
  );

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
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === OPEN_LINK && link) openLink(link);
  };

  return (
    <Row $mine={mine}>
      <Bubble
        $mine={mine}
        onPress={copyToClipboard}
        accessibilityRole="button"
        accessibilityLabel={`Mensagem de ${
          mine ? 'você' : authorName
        }, ${time}. ${text}`}
        accessibilityHint="Toque para copiar"
        accessibilityActions={
          link ? [{ name: OPEN_LINK, label: 'Abrir link' }] : undefined
        }
        onAccessibilityAction={link ? onAccessibilityAction : undefined}
        style={({ pressed }) => ({
          backgroundColor: mine
            ? pressed
              ? theme.colors.selection
              : theme.colors.accentSoft
            : pressed
              ? theme.colors.surfaceStrong
              : theme.colors.surfaceMuted,
        })}
      >
        <Head>
          <Author variant="meta" weight="semibold" numberOfLines={1}>
            {author}
          </Author>
          {time ? (
            <Text variant="caption" weight="regular" tone="muted" tabular>
              {time}
            </Text>
          ) : null}
        </Head>
        {/*
          O filho direto é o Text do React Native de propósito: o Hyperlink só
          reconhece `displayName === 'Text'` e, com outro componente, segue um
          caminho que espalha `key` no JSX (erro no console a cada conversa).
        */}
        <Hyperlink onPress={openLink} linkStyle={linkStyle}>
          <RNText style={bodyStyle}>{text}</RNText>
        </Hyperlink>
      </Bubble>
    </Row>
  );
};

export default ChatBubble;
