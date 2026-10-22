import React from 'react';
import { StyleSheet } from 'react-native';
import { Notice } from '@components/ui/Notice';
import { PORTAL_BLOCKED_TEXT, UpdatingBar } from '@components/ui/Feedback';
import { PortalDownNotice } from '@root/modules/connectivity/presentation/PortalDownNotice';
import { usePortalStatus } from '@root/modules/connectivity/presentation/PortalStatusContext';
import { AppError, errorMessage } from '@root/shared/errors/AppError';
import { useOnlineStatus } from './useOnlineStatus';

type Props = {
  isPaused: boolean;
  isFetching: boolean;
  error: unknown;
  hasData: boolean;
  retry: () => unknown;
  dataUpdatedAt?: number;
  /**
   * Os dados vêm do Aluno Online (padrão): mostra a queda do portal. Falso
   * para a nossa API (mural), que não depende dele.
   */
  portal?: boolean;
};

/**
 * Background failures must leave the last successful result visible.
 *
 * Aviso padrão das telas de dados: sem conexão (neutro), portal fora do ar
 * (atenção, com "Tentar agora"), falha ao atualizar (atenção) ou portal
 * bloqueado (crítico); e a barra fina enquanto a conta entra no portal na
 * abertura ou os dados salvos são atualizados.
 */
export function QueryNotice({
  isPaused,
  isFetching,
  error,
  hasData,
  retry,
  dataUpdatedAt,
  portal = true,
}: Props) {
  const online = useOnlineStatus();
  const portalStatus = usePortalStatus();
  const updatedAt = dataUpdatedAt
    ? ` Última atualização: ${new Date(dataUpdatedAt).toLocaleString('pt-BR')}.`
    : '';
  const onRetry = () => {
    retry();
  };
  if (isPaused || !online) {
    return (
      <Notice
        kind="offline"
        style={styles.notice}
        onRetry={onRetry}
        text={
          hasData
            ? `Sem conexão. Exibindo os últimos dados salvos.${updatedAt}`
            : 'Sem conexão. A consulta será retomada quando você se conectar.'
        }
      />
    );
  }
  if (portal && portalStatus.down) {
    return (
      <PortalDownNotice
        style={styles.notice}
        suffix={hasData ? ` Exibindo os últimos dados salvos.${updatedAt}` : ''}
      />
    );
  }
  if (error && hasData) {
    const blocked =
      error instanceof AppError && error.code === 'POSSIBLY_BLOCKED';
    return (
      <Notice
        kind={blocked ? 'blocked' : 'refreshFailed'}
        style={styles.notice}
        onRetry={onRetry}
        text={
          blocked
            ? `${PORTAL_BLOCKED_TEXT} Exibindo os últimos dados salvos.${updatedAt}`
            : `Não foi possível atualizar. ${errorMessage(
                error,
              )} Exibindo os últimos dados salvos.${updatedAt}`
        }
      />
    );
  }
  // na abertura, a conta salva aparece na hora e entra no portal por trás
  if (portal && portalStatus.signingIn && hasData) {
    return <UpdatingBar label="Entrando no Aluno Online…" style={styles.bar} />;
  }
  if (isFetching && hasData) {
    return (
      <UpdatingBar
        label={
          portal && portalStatus.slow
            ? 'O Aluno Online está lento. Atualizando…'
            : 'Atualizando dados…'
        }
        style={styles.bar}
      />
    );
  }
  return null;
}

const styles = StyleSheet.create({
  notice: { marginBottom: 20 },
  bar: { marginBottom: 16 },
});
