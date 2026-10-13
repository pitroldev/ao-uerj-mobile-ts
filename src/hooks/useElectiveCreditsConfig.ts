import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import {
  defaultElectiveCredits,
  normalizeElectiveCredits,
  ElectiveCreditsConfig,
  ElectiveType,
} from '@root/modules/academics/domain/rules/progress';

export type {
  ElectiveCreditsConfig,
  ElectiveType,
} from '@root/modules/academics/domain/rules/progress';
const STORAGE_KEY = 'elective-credits';

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
  const config = query.data ?? defaultElectiveCredits;

  const setConfig = async (
    value:
      | ElectiveCreditsConfig
      | ((previous: ElectiveCreditsConfig) => ElectiveCreditsConfig),
  ): Promise<boolean> => {
    if (!scope || identity.getSnapshot().account?.scope !== scope) return false;
    const previous =
      queryClient.getQueryData<ElectiveCreditsConfig>(queryKey) ?? config;
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
