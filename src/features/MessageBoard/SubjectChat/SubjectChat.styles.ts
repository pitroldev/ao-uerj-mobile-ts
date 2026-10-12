import { StyleSheet } from 'react-native';
import styled from 'styled-components/native';

import { Card, Text } from '@components/ui';

/** ".chat-meta": código · turma, 2 abaixo do nome e 12 acima do seletor. */
export const ChatMeta = styled(Text)`
  margin: 2px 0px 12px;
`;

/** Aviso de conexão/atualização, fixo entre o cabeçalho e a conversa. */
export const NoticeSlot = styled.View`
  padding: 12px ${({ theme }) => theme.layout.gutter}px 0px;
  margin-bottom: -16px;
`;

/** ".chat-hint": dica tracejada da conversa vazia. */
export const Hint = styled(Card)`
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
  margin-top: 12px;
`;

export const HintText = styled(Text)`
  flex: 1;
`;

/** ".composer": campo que cresce até ~5 linhas e o botão de enviar. */
export const Composer = styled.View`
  flex-direction: row;
  align-items: flex-end;
  gap: 8px;
`;

export const styles = StyleSheet.create({
  /** ".panel.chat .panel-top": 22 no topo, 20 nas laterais, 12 embaixo. */
  header: { paddingTop: 22, paddingHorizontal: 20, paddingBottom: 12 },
  flex: { flex: 1 },
  composerField: { flex: 1, minWidth: 0 },
  /** Uma linha como o campo do protótipo; cresce com o texto até ~5 linhas. */
  composerInput: { minHeight: 0, maxHeight: 128 },
});
