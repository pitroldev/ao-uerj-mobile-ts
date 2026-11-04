import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { isTransientError } from '@root/shared/errors/AppError';
import { COMPANION_NAME_KEY } from '../application/CompanionCalls';
import {
  CompanionError,
  firstNameOf,
  isValidName,
  type CallList,
  type MemberCall,
  type Membership,
} from '../domain/companion';

/** A lista muda a cada minuto (vagas, quem chamou); a chamada, mais rápido. */
const LIST_POLL_MS = 20_000;
const CALL_POLL_MS = 10_000;

export const companionKeys = {
  all: (scope: string) => ['companion', scope] as const,
  calls: (scope: string) => ['companion', scope, 'calls'] as const,
  call: (scope: string, callId: string) =>
    ['companion', scope, 'call', callId] as const,
  name: (scope: string) => ['companion', scope, 'name'] as const,
};

const retry = (count: number, error: unknown) =>
  isTransientError(error) && count < 2;

/** As participações guardadas no aparelho (a chamada aberta e as que entrou). */
export function useMemberships(): readonly Membership[] {
  const { companion } = useAppServices();
  useEffect(() => {
    void companion.load();
  }, [companion]);
  return useSyncExternalStore(companion.subscribe, companion.getSnapshot);
}

/**
 * As chamadas abertas agora e quantos estão de olho. Atualiza a cada 20 s
 * enquanto `poll` (a tela na frente); o passe de leitura vale uma hora e sai
 * da sessão de aluno.
 */
export function useCompanionCalls({
  enabled = true,
  poll = true,
  interval = LIST_POLL_MS,
}: { enabled?: boolean; poll?: boolean; interval?: number } = {}) {
  const { companion } = useAppServices();
  const { account } = useIdentity();
  const scope = account?.scope ?? 'signed-out';
  return useQuery<CallList>({
    queryKey: companionKeys.calls(scope),
    queryFn: ({ signal }) => companion.list({ signal }),
    enabled: enabled && companion.supported && Boolean(account),
    refetchInterval: poll ? interval : false,
    staleTime: LIST_POLL_MS / 2,
    retry,
  });
}

/** A chamada por dentro (nomes e recados), de 10 em 10 s com a tela na frente. */
export function useMemberCall(
  callId: string | null,
  { poll = true }: { poll?: boolean } = {},
) {
  const { companion } = useAppServices();
  const { account } = useIdentity();
  const memberships = useMemberships();
  const member = Boolean(
    callId && memberships.some(item => item.callId === callId),
  );
  const scope = account?.scope ?? 'signed-out';
  return useQuery<MemberCall>({
    queryKey: companionKeys.call(scope, callId ?? ''),
    queryFn: ({ signal }) => companion.read(callId as string, { signal }),
    enabled: Boolean(callId) && member && companion.supported,
    refetchInterval: poll ? CALL_POLL_MS : false,
    staleTime: CALL_POLL_MS / 2,
    retry: (count, error) =>
      !(error instanceof CompanionError) && retry(count, error),
  });
}

/**
 * O primeiro nome que vai nas chamadas: o da conta, ou o que o aluno
 * escolheu (o nome social, um apelido), guardado só no aparelho.
 */
export function useCompanionName() {
  const { preferences } = useAppServices();
  const { account } = useIdentity();
  const queryClient = useQueryClient();
  const scope = account?.scope;
  const fallback = useMemo(
    () => firstNameOf(account?.name ?? ''),
    [account?.name],
  );
  const queryKey = companionKeys.name(scope ?? 'signed-out');
  const query = useQuery({
    queryKey,
    queryFn: async () =>
      (await preferences.read<string>(scope as string, COMPANION_NAME_KEY)) ??
      null,
    enabled: Boolean(scope),
    networkMode: 'always',
    staleTime: Infinity,
    retry: false,
  });
  const saved = query.data;
  const name = saved && isValidName(saved) ? saved : fallback;

  const setName = useCallback(
    async (next: string) => {
      if (!scope) return false;
      const value = next.trim();
      if (!isValidName(value)) return false;
      try {
        await preferences.write(scope, COMPANION_NAME_KEY, value);
        queryClient.setQueryData(companionKeys.name(scope), value);
        return true;
      } catch {
        return false;
      }
    },
    [preferences, queryClient, scope],
  );

  return { name, fallback, chosen: Boolean(saved), setName };
}
