import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { hashKey, useQueryClient } from '@tanstack/react-query';

import { useIdentity } from '@root/app/providers/AppServicesProvider';
import type { SubjectsTaken } from '@root/modules/academics/domain/models';
import { academicKeys } from '@root/modules/academics/presentation/queryKeys';

/**
 * Histórico (Disciplinas Realizadas) que já está salvo no cache, sem disparar
 * uma consulta ao portal. Serve só para marcar os requisitos cumpridos
 * ("Aprovado em 2025.2"); sem histórico salvo, a marca simplesmente não
 * aparece. Atualiza quando o histórico chega por outra tela.
 */
export function useCachedHistory(): SubjectsTaken[] | undefined {
  const queryClient = useQueryClient();
  const { account } = useIdentity();
  const scope = account?.scope;
  const period = account?.period ?? '';

  const key = useMemo(
    () => (scope ? academicKeys.resource(scope, period, 'history') : null),
    [scope, period],
  );

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!key) return () => undefined;
      const hash = hashKey(key);
      return queryClient.getQueryCache().subscribe(event => {
        if (event.query.queryHash === hash) onChange();
      });
    },
    [queryClient, key],
  );

  const getSnapshot = useCallback(
    () => (key ? queryClient.getQueryData<SubjectsTaken[]>(key) : undefined),
    [queryClient, key],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
