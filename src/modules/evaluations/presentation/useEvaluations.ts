import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import type { Evaluation } from '../domain/evaluations';
import { evaluationsQueryKey } from './queryKeys';

const NONE: Evaluation[] = [];

/**
 * Provas e trabalhos anotados na conta ativa, no período atual (só no
 * aparelho), e as ações de anotar, excluir e marcar como feito. Cada mudança
 * refaz os lembretes agendados.
 */
export function useEvaluations() {
  const { evaluations: records, identity, notifications } = useAppServices();
  const { account } = useIdentity();
  const queryClient = useQueryClient();
  const scope = account?.scope;
  const period = account?.period ?? 'current';
  const queryKey = useMemo(
    () => evaluationsQueryKey(scope, period),
    [scope, period],
  );
  const query = useQuery({
    queryKey,
    queryFn: () => records.read(scope as string, period),
    enabled: Boolean(scope),
    // a leitura é do aparelho: sem rede as datas continuam aparecendo
    networkMode: 'always',
    staleTime: Infinity,
    retry: false,
  });
  const evaluations = query.data ?? NONE;

  /** Devolve `false` se não gravou (outra conta entrou ou o disco falhou). */
  const run = useCallback(
    async (change: (owner: string) => Promise<Evaluation[]>) => {
      if (!scope || identity.getSnapshot().account?.scope !== scope) {
        return false;
      }
      try {
        const next = await change(scope);
        if (identity.getSnapshot().account?.scope !== scope) return false;
        queryClient.setQueryData(queryKey, next);
        void notifications.settings.evaluationsChanged();
        return true;
      } catch {
        return false;
      }
    },
    [identity, notifications, queryClient, queryKey, scope],
  );

  const save = useCallback(
    (evaluation: Evaluation) =>
      run(owner => records.save(owner, period, evaluation)),
    [period, records, run],
  );
  const remove = useCallback(
    (id: string) => run(owner => records.remove(owner, period, id)),
    [period, records, run],
  );
  const setDone = useCallback(
    (id: string, done: boolean) =>
      run(owner => records.setDone(owner, period, [id], done)),
    [period, records, run],
  );

  return { evaluations, save, remove, setDone };
}
