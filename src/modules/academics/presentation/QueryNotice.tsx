import React from 'react';
import SmallDummyMessage from '@molecules/SmallDummyMessage';
import { errorMessage } from '@root/shared/errors/AppError';
import { useOnlineStatus } from './useOnlineStatus';

type Props = {
  isPaused: boolean;
  isFetching: boolean;
  error: unknown;
  hasData: boolean;
  retry: () => unknown;
  dataUpdatedAt?: number;
};

/** Background failures must leave the last successful result visible. */
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
  if (isPaused || !online) {
    return (
      <SmallDummyMessage
        type="ERROR"
        text={
          hasData
            ? `Sem conexão. Exibindo os últimos dados salvos.${updatedAt}`
            : 'Sem conexão. A consulta será retomada quando você se conectar.'
        }
        onPress={retry}
      />
    );
  }
  if (error && hasData) {
    return (
      <SmallDummyMessage
        type="ERROR"
        text={`Não foi possível atualizar. ${errorMessage(
          error,
        )} Exibindo os últimos dados salvos.${updatedAt}`}
        onPress={retry}
      />
    );
  }
  if (isFetching && hasData) {
    return <SmallDummyMessage type="INFO" text="Atualizando dados…" />;
  }
  return null;
}
