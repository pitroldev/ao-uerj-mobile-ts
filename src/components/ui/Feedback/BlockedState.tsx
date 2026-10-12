import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { EmptyState } from './EmptyState';
import { PORTAL_BLOCKED_FULL_TEXT } from './blockedText';

export { PORTAL_BLOCKED_FULL_TEXT, PORTAL_BLOCKED_TEXT } from './blockedText';

export type BlockedStateProps = {
  /** "Tentar novamente". */
  onRetry?: () => void;
  /** Padrão `PORTAL_BLOCKED_FULL_TEXT`. */
  text?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Portal bloqueado sem dados para mostrar: cadeado na caixa vermelha, o texto
 * padrão (anunciado como alerta) e "Tentar novamente".
 */
export function BlockedState({
  onRetry,
  text = PORTAL_BLOCKED_FULL_TEXT,
  style,
}: BlockedStateProps) {
  return (
    <EmptyState
      icon="lock"
      tone="bad"
      text={text}
      style={style}
      action={
        onRetry
          ? { label: 'Tentar novamente', icon: 'refresh', onPress: onRetry }
          : undefined
      }
    />
  );
}

export default BlockedState;
