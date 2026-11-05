import React from 'react';
import styled from 'styled-components/native';

import { Button, Text } from '@components/ui';

/** Respiro em cima: fica abaixo de um estado vazio ou de outro botão. */
const Root = styled.View`
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xxs}px;
  padding: ${({ theme }) => theme.spacing.lg}px
    ${({ theme }) => theme.spacing.sm}px ${({ theme }) => theme.spacing.sm}px;
`;

type Props = {
  /** Por que convidar ajuda aqui, numa frase curta (cabe numa linha). */
  text: string;
  onPress: () => void;
};

/**
 * Um convite discreto onde o recurso depende da turma e ainda está vazio: a
 * frase apagada e um botão de texto. Nunca abre nada sozinho.
 */
export function InviteLine({ text, onPress }: Props) {
  return (
    <Root>
      <Text variant="meta" tone="muted" align="center">
        {text}
      </Text>
      <Button
        variant="text"
        size="sm"
        icon="share"
        label="Convidar a turma"
        onPress={onPress}
      />
    </Root>
  );
}
