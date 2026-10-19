import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import {
  defaultElectiveCredits,
  normalizeElectiveCredits,
  synthesisElectiveCredits,
  ElectiveCreditsConfig,
  ElectiveType,
} from '@root/modules/academics/domain/rules/progress';
import { useSynthesis } from '@root/modules/academics/presentation/queries';

export type {
  ElectiveCreditsConfig,
  ElectiveType,
} from '@root/modules/academics/domain/rules/progress';
const STORAGE_KEY = 'elective-credits';

/**
 * Créditos exigidos de cada grupo de eletivas. Os que a Síntese da Formação
 * informa valem sozinhos; os demais são os configurados em Meu Progresso
 * (também quando a Síntese não carrega).
 */
export function useElectiveCreditsConfig() {
  const { preferences, identity } = useAppServices();
  const { account } = useIdentity();
  const queryClient = useQueryClient();
  const scope = account?.scope;
  const queryKey = ['preferences', scope ?? 'signed-out', STORAGE_KEY];
  const query = useQuery({
    queryKey,
    queryFn: async () =>
      normalizeElectiveCredits(
        await preferences.read<ElectiveCreditsConfig>(scope!, STORAGE_KEY),
      ),
    enabled: Boolean(scope),
    staleTime: Infinity,
    retry: false,
  });
  const stored = query.data ?? defaultElectiveCredits;
  const synthesisQuery = useSynthesis();
  const fromSynthesis = useMemo(
    () => synthesisElectiveCredits(synthesisQuery.data ?? null),
    [synthesisQuery.data],
  );
  const config = useMemo(
    () => ({ ...stored, ...fromSynthesis }),
    [stored, fromSynthesis],
  );

  const setConfig = async (
    value:
      | ElectiveCreditsConfig
      | ((previous: ElectiveCreditsConfig) => ElectiveCreditsConfig),
  ): Promise<boolean> => {
    if (!scope || identity.getSnapshot().account?.scope !== scope) return false;
    const previous =
      queryClient.getQueryData<ElectiveCreditsConfig>(queryKey) ?? stored;
    const next = normalizeElectiveCredits(
      typeof value === 'function' ? value(previous) : value,
    );
    try {
      await preferences.write(scope, STORAGE_KEY, next);
    } catch {
      return false;
    }
    if (identity.getSnapshot().account?.scope !== scope) return false;
    queryClient.setQueryData(queryKey, next);
    return true;
  };

  return {
    config,
    /** Os grupos que vieram da Síntese da Formação (0: não exigido). */
    fromSynthesis,
    /** A Síntese ainda está na primeira leitura: o que falta pode chegar. */
    synthesisPending:
      synthesisQuery.isLoading && synthesisQuery.data === undefined,
    setConfig,
    updateCredits: (type: ElectiveType, credits: number) =>
      setConfig(previous => ({ ...previous, [type]: credits })),
    resetConfig: () => setConfig(defaultElectiveCredits),
    refresh: query.refetch,
    loading: query.isLoading,
    error: query.error,
    hasConfiguredCredits: (type: ElectiveType) => config[type] > 0,
    getRemainingCredits: (type: ElectiveType, completed: number) =>
      Math.max(0, config[type] - completed),
    getProgress: (type: ElectiveType, completed: number) =>
      config[type] > 0
        ? Math.min(100, Math.round((completed / config[type]) * 100))
        : 0,
  };
}
