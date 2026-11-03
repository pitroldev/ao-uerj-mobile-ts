import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { toIsoDate } from '@root/modules/attendance/domain/attendance';
import { COMPANION_INVITE_KEY } from '../application/CompanionCalls';

/**
 * O convite da Companhia agora no Início, quando a lista está vazia na janela
 * livre: "Agora não" o esconde até o fim do dia, só neste aparelho.
 */
export function useCompanionInvite(now: Date) {
  const { preferences } = useAppServices();
  const { account } = useIdentity();
  const queryClient = useQueryClient();
  const scope = account?.scope;
  const today = toIsoDate(now);
  const queryKey = useMemo(
    () => ['companion', scope ?? 'signed-out', 'invite'] as const,
    [scope],
  );
  const query = useQuery({
    queryKey,
    queryFn: async () =>
      (await preferences.read<string>(scope as string, COMPANION_INVITE_KEY)) ??
      null,
    enabled: Boolean(scope),
    networkMode: 'always',
    staleTime: Infinity,
    retry: false,
  });

  const dismiss = useCallback(async () => {
    if (!scope) return;
    queryClient.setQueryData(queryKey, today);
    await preferences
      .write(scope, COMPANION_INVITE_KEY, today)
      .catch(() => undefined);
  }, [preferences, queryClient, queryKey, scope, today]);

  return {
    /** Ainda não leu a preferência: o convite espera, para não piscar. */
    ready: query.isSuccess,
    dismissed: query.data === today,
    dismiss,
  };
}
