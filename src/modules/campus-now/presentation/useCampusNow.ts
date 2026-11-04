import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { isTransientError } from '@root/shared/errors/AppError';
import type { CampusNowSnapshot } from '../application/CampusNow';
import {
  CampusNowError,
  type CampusNotice,
  type CommunitySummary,
  type Earned,
  type NoticeAnswer,
  type NoticeList,
  type NoticeRequest,
  type NoticeResult,
  type YouSummary,
} from '../domain/campusNow';

/** Com a tela na frente, a lista anda a cada 30 s; no Início, a cada minuto. */
const LIST_POLL_MS = 30_000;
export const HOME_POLL_MS = 60_000;

const campusKeys = {
  all: (scope: string) => ['campus-now', scope] as const,
  list: (scope: string) => ['campus-now', scope, 'list'] as const,
  you: (scope: string) => ['campus-now', scope, 'you'] as const,
  community: (scope: string, month: string) =>
    ['campus-now', scope, 'community', month] as const,
};

const retry = (count: number, error: unknown) =>
  !(error instanceof CampusNowError) && isTransientError(error) && count < 2;

function useScope() {
  const { account } = useIdentity();
  return account?.scope ?? 'signed-out';
}

/**
 * As escolhas do aparelho (o que o aluno dispensou hoje, a primeira visita e
 * o que o celular já perguntou), relidas quando o app volta para a frente: a
 * verificação sem tela pode ter perguntado algo nesse meio-tempo.
 */
export function useCampusNowState(): CampusNowSnapshot {
  const { campusNow } = useAppServices();
  useEffect(() => {
    void campusNow.load();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void campusNow.load();
    });
    return () => subscription.remove();
  }, [campusNow]);
  return useSyncExternalStore(campusNow.subscribe, campusNow.getSnapshot);
}

/**
 * Os avisos que valem agora, quantos ajudaram hoje e os pontos do aluno.
 * Atualiza a cada `interval` enquanto `poll` (a tela na frente).
 */
export function useCampusNotices({
  enabled = true,
  poll = true,
  interval = LIST_POLL_MS,
}: { enabled?: boolean; poll?: boolean; interval?: number } = {}) {
  const { campusNow } = useAppServices();
  const { account } = useIdentity();
  const scope = useScope();
  const query = useQuery<NoticeList>({
    queryKey: campusKeys.list(scope),
    queryFn: ({ signal }) => campusNow.list({ signal }),
    enabled: enabled && campusNow.supported && Boolean(account),
    refetchInterval: poll ? interval : false,
    staleTime: LIST_POLL_MS / 2,
    retry,
  });
  // o que a tela já mostrou (o nível, o aviso confirmado) não vira aviso do celular
  const { data } = query;
  useEffect(() => {
    if (data) void campusNow.observe(data).catch(() => undefined);
  }, [campusNow, data]);
  return query;
}

/** Os pontos, as contagens, a semana e os avisos de hoje do aluno. */
export function useCampusYou({ enabled = true }: { enabled?: boolean } = {}) {
  const { campusNow } = useAppServices();
  const { account } = useIdentity();
  const scope = useScope();
  return useQuery<YouSummary>({
    queryKey: campusKeys.you(scope),
    queryFn: ({ signal }) => campusNow.you({ signal }),
    enabled: enabled && campusNow.supported && Boolean(account),
    staleTime: 60_000,
    retry,
  });
}

/** O campus somado: a semana e o mês (`month` AAAA-MM). */
export function useCampusCommunity(
  month: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { campusNow } = useAppServices();
  const { account } = useIdentity();
  const scope = useScope();
  return useQuery<CommunitySummary>({
    queryKey: campusKeys.community(scope, month),
    queryFn: ({ signal }) => campusNow.community(month, { signal }),
    enabled: enabled && campusNow.supported && Boolean(account),
    // trocar de mês mantém o resumo anterior na tela até o novo chegar
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    retry,
  });
}

/** Troca (ou tira, se já não vale) um aviso na lista guardada. */
function putNotice(
  queryClient: QueryClient,
  scope: string,
  notice: CampusNotice,
  { you, replaced = null }: { you?: Earned; replaced?: string | null } = {},
) {
  queryClient.setQueryData<NoticeList>(campusKeys.list(scope), current => {
    if (!current) return current;
    const others = current.notices.filter(
      item => item.id !== notice.id && item.id !== replaced,
    );
    const index = current.notices.findIndex(item => item.id === notice.id);
    const notices =
      notice.state !== 'active'
        ? others
        : index >= 0
          ? current.notices
              .filter(item => item.id !== replaced)
              .map(item => (item.id === notice.id ? notice : item))
          : [notice, ...others];
    return {
      ...current,
      notices,
      you: you
        ? {
            points: you.points,
            level: you.level,
            levelAt: you.levelAt,
            nextLevelAt: you.nextLevelAt,
          }
        : current.you,
    };
  });
}

export type ActionOutcome = {
  notice: CampusNotice;
  /** Os pontos de antes, para dizer o que mudou (e o nível novo). */
  before: number | null;
  you: Earned;
};

/**
 * As ações do aluno (avisar, responder, agradecer, denunciar, dispensar),
 * com a lista guardada atualizada na hora: quem respondeu não espera a
 * próxima busca para ver o próprio voto.
 */
export function useCampusActions() {
  const { campusNow } = useAppServices();
  const queryClient = useQueryClient();
  const scope = useScope();

  const levelBefore = useCallback(
    () =>
      queryClient.getQueryData<NoticeList>(campusKeys.list(scope))?.you.level ??
      null,
    [queryClient, scope],
  );

  // os números de todos (quantos ajudaram hoje) e os do aluno vêm de novo
  const settle = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: campusKeys.you(scope) });
    void queryClient.invalidateQueries({ queryKey: campusKeys.list(scope) });
  }, [queryClient, scope]);

  const report = useCallback(
    async (
      request: NoticeRequest,
    ): Promise<NoticeResult & { before: number | null }> => {
      const before = levelBefore();
      const result = await campusNow.report(request);
      putNotice(queryClient, scope, result.notice, {
        you: result.you,
        replaced: result.replaced,
      });
      settle();
      return { ...result, before };
    },
    [campusNow, levelBefore, queryClient, scope, settle],
  );

  const answer = useCallback(
    async (id: string, value: NoticeAnswer): Promise<ActionOutcome> => {
      const before = levelBefore();
      try {
        const result = await campusNow.answer(id, value);
        putNotice(queryClient, scope, result.notice, { you: result.you });
        settle();
        return { ...result, before };
      } catch (error) {
        // acabou ou já respondido: a lista guardada está velha
        if (error instanceof CampusNowError)
          void queryClient.invalidateQueries({
            queryKey: campusKeys.list(scope),
          });
        throw error;
      }
    },
    [campusNow, levelBefore, queryClient, scope, settle],
  );

  const thank = useCallback(
    async (id: string): Promise<ActionOutcome> => {
      const before = levelBefore();
      const result = await campusNow.thank(id);
      putNotice(queryClient, scope, result.notice, { you: result.you });
      settle();
      return { ...result, before };
    },
    [campusNow, levelBefore, queryClient, scope, settle],
  );

  const flag = useCallback(
    async (id: string) => {
      await campusNow.flag(id);
      queryClient.setQueryData<NoticeList>(campusKeys.list(scope), current =>
        current
          ? {
              ...current,
              notices: current.notices.map(item =>
                item.id === id ? { ...item, flagged: true } : item,
              ),
            }
          : current,
      );
    },
    [campusNow, queryClient, scope],
  );

  const skip = useCallback((id: string) => campusNow.skip(id), [campusNow]);

  return { report, answer, thank, flag, skip };
}
