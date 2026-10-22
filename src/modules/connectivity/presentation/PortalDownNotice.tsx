import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Notice } from '@components/ui/Notice';
import { portalDownText } from './portalStatusText';
import { usePortalStatus } from './PortalStatusContext';

type Props = {
  /** Texto depois da situação ("Exibindo os últimos dados salvos…"). */
  suffix?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * O portal não responde com a internet funcionando: de quando, se é de
 * todos, a próxima tentativa, "Tentar agora" e, no Android, "Avisar quando
 * voltar".
 */
export function PortalDownNotice({ suffix = '', style }: Props) {
  const status = usePortalStatus();
  const alert = status.returnAlert;
  return (
    <Notice
      kind="portalDown"
      style={style}
      text={`${portalDownText(status, status.observedAt)}${suffix}`}
      action={{
        label: 'Tentar agora',
        onPress: () => {
          void status.retryNow();
        },
      }}
      secondaryAction={
        alert.supported
          ? alert.requested
            ? {
                label: 'Cancelar aviso',
                accessibilityLabel:
                  'Cancelar o aviso de quando o Aluno Online voltar',
                onPress: () => {
                  void alert.cancel();
                },
              }
            : {
                label: 'Avisar quando voltar',
                accessibilityLabel: 'Avisar quando o Aluno Online voltar',
                onPress: () => {
                  void alert.request();
                },
              }
          : undefined
      }
    />
  );
}
