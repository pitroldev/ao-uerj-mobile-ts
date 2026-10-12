import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled from 'styled-components/native';

import { Button } from '../Button/Button';
import { Card } from '../Card/Card';
import { type IconName } from '../Icon';
import { Text } from '../Text';
import { IconTile } from './IconTile';

type Action = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  accessibilityLabel?: string;
};

export type EmptyStateProps = {
  /** Frase real do app (15/22, centralizada). */
  text: string;
  /** Título opcional acima do texto. */
  title?: string;
  /** Ícone na caixa de 64dp. Padrão "info". */
  icon?: IconName;
  /** `bad` pinta a caixa de vermelho (erro, bloqueado). */
  tone?: 'neutral' | 'bad';
  /** Botão contornado pequeno abaixo do texto. */
  action?: Action;
  style?: StyleProp<ViewStyle>;
};

const Root = styled.View`
  align-items: center;
  gap: 14px;
  padding: 40px 8px;
`;

const Copy = styled.View`
  max-width: 300px;
  gap: 4px;
`;

const Message = styled(Text)`
  line-height: 22px;
`;

/** Estado vazio (".empty"): ícone em caixa, frase e ação opcional. */
export function EmptyState({
  text,
  title,
  icon = 'info',
  tone = 'neutral',
  action,
  style,
}: EmptyStateProps) {
  return (
    <Root style={style}>
      <IconTile icon={icon} size="lg" tone={tone === 'bad' ? 'bad' : 'muted'} />
      <Copy>
        {title ? (
          <Text variant="headline" align="center" accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        <Message
          variant="body"
          tone="muted"
          align="center"
          accessibilityRole={tone === 'bad' ? 'alert' : undefined}
        >
          {text}
        </Message>
      </Copy>
      {action ? (
        <Button
          variant="outline"
          size="sm"
          icon={action.icon}
          label={action.label}
          accessibilityLabel={action.accessibilityLabel}
          onPress={action.onPress}
        />
      ) : null}
    </Root>
  );
}

export type ErrorStateProps = {
  /** Mensagem real do erro. */
  message: string;
  /** Título opcional acima da mensagem (só na variante `centered`). */
  title?: string;
  onRetry?: () => void;
  /** Padrão "Tentar novamente". */
  retryLabel?: string;
  icon?: IconName;
  /**
   * `centered` (padrão): estado vazio vermelho. `card`: caixa compacta com
   * ícone à esquerda (".errbox", erro do Início acima da ajuda).
   */
  variant?: 'centered' | 'card';
  style?: StyleProp<ViewStyle>;
};

const ErrorCard = styled(Card)`
  flex-direction: row;
  gap: 12px;
`;

const ErrorBody = styled.View`
  flex: 1;
  min-width: 0px;
  gap: 4px;
`;

const RETRY_STYLE = { alignSelf: 'flex-start', marginTop: 8 } as const;

/** Estado de erro com "Tentar novamente". */
export function ErrorState({
  message,
  title,
  onRetry,
  retryLabel = 'Tentar novamente',
  icon = 'error',
  variant = 'centered',
  style,
}: ErrorStateProps) {
  if (variant === 'card') {
    return (
      <ErrorCard style={style}>
        <IconTile icon={icon} tone="bad" />
        <ErrorBody>
          <Text accessibilityRole="alert">{message}</Text>
          {onRetry ? (
            <Button
              variant="outline"
              size="sm"
              icon="refresh"
              label={retryLabel}
              onPress={onRetry}
              style={RETRY_STYLE}
            />
          ) : null}
        </ErrorBody>
      </ErrorCard>
    );
  }
  return (
    <EmptyState
      text={message}
      title={title}
      icon={icon}
      tone="bad"
      style={style}
      action={
        onRetry
          ? { label: retryLabel, icon: 'refresh', onPress: onRetry }
          : undefined
      }
    />
  );
}

export default EmptyState;
