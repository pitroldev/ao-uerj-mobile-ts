import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import {
  DEFAULT_HOME_LAYOUT,
  HOME_LAYOUT_KEY,
  normalizeHomeLayout,
  type HomeLayout,
} from '../domain/homeLayout';

const layoutKey = (scope: string) => ['home', scope, 'layout'] as const;

/**
 * O layout do Início da conta ativa, guardado só no aparelho. Cada mudança
 * vale na hora (a tela atrás da folha já muda) e é gravada em seguida; se o
 * disco falhar, a tela volta ao que estava salvo.
 */
export function useHomeLayout() {
  const { preferences } = useAppServices();
  const { account } = useIdentity();
  const queryClient = useQueryClient();
  const scope = account?.scope;
  const query = useQuery({
    queryKey: layoutKey(scope ?? 'signed-out'),
    queryFn: async () =>
      normalizeHomeLayout(
        await preferences.read<unknown>(scope as string, HOME_LAYOUT_KEY),
      ),
    enabled: Boolean(scope),
    networkMode: 'always',
    staleTime: Infinity,
    retry: false,
  });
  const layout = query.data ?? DEFAULT_HOME_LAYOUT;

  const save = useCallback(
    async (next: HomeLayout) => {
      if (!scope) return false;
      const key = layoutKey(scope);
      const previous = queryClient.getQueryData<HomeLayout>(key);
      queryClient.setQueryData(key, next);
      try {
        await preferences.write(scope, HOME_LAYOUT_KEY, next);
        return true;
      } catch {
        queryClient.setQueryData(key, previous ?? DEFAULT_HOME_LAYOUT);
        return false;
      }
    },
    [preferences, queryClient, scope],
  );

  /** Aplica uma mudança ao layout que está valendo agora. */
  const change = useCallback(
    (update: (current: HomeLayout) => HomeLayout) => {
      if (!scope) return Promise.resolve(false);
      const current =
        queryClient.getQueryData<HomeLayout>(layoutKey(scope)) ??
        DEFAULT_HOME_LAYOUT;
      return save(update(current));
    },
    [queryClient, save, scope],
  );

  const reset = useCallback(() => save(DEFAULT_HOME_LAYOUT), [save]);

  return { layout, ready: query.isSuccess, change, reset };
}
