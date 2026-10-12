import React from 'react';
import { StyleSheet } from 'react-native';
import { Notice } from '@components/ui/Notice';
import { PORTAL_BLOCKED_TEXT, UpdatingBar } from '@components/ui/Feedback';
import { AppError, errorMessage } from '@root/shared/errors/AppError';
import { useOnlineStatus } from './useOnlineStatus';

type Props = {
  isPaused: boolean;
  isFetching: boolean;
  error: unknown;
  hasData: boolean;
  retry: () => unknown;
  dataUpdatedAt?: number;
};

/**
 * Background failures must leave the last successful result visible.
 *
 * Aviso padrão das telas de dados: sem conexão (neutro), falha ao atualizar
 * (atenção) ou portal bloqueado (crítico), todos com "Tentar novamente"; e a
 * barra fina enquanto os dados salvos são atualizados.
 */
export function QueryNotice({
  isPaused,
  isFetching,
  error,
  hasData,
  retry,
  dataUpdatedAt,
}: Props) {
  const online = useOnlineStatus();
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
  if (isFetching && hasData) {
    return <UpdatingBar label="Atualizando dados…" style={styles.bar} />;
  }
  return null;
}

const styles = StyleSheet.create({
  notice: { marginBottom: 20 },
  bar: { marginBottom: 16 },
});
