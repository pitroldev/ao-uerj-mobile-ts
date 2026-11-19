import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { isTransientError } from '@root/shared/errors/AppError';
import type { IdeasSnapshot } from '../application/Ideas';
import {
  IdeaError,
  withIdea,
  type IdeaDraft,
  type MyIdea,
  type MyIdeas,
  type SimilarIdea,
} from '../domain/ideas';

const ideaKeys = {
  mine: (scope: string) => ['ideas', scope, 'mine'] as const,
};

const retry = (count: number, error: unknown) =>
  !(error instanceof IdeaError) && isTransientError(error) && count < 2;

function useScope() {
  const { account } = useIdentity();
  return account?.scope ?? 'signed-out';
}

/** O que o aparelho guarda (se o aluno já sugeriu, as feitas já vistas). */
export function useIdeasState(): IdeasSnapshot {
  const { ideas } = useAppServices();
  useEffect(() => {
    void ideas.load();
  }, [ideas]);
  return useSyncExternalStore(ideas.subscribe, ideas.getSnapshot);
}

/** As sugestões do aluno e quantas ele ainda manda hoje. */
export function useMyIdeas({ enabled = true }: { enabled?: boolean } = {}) {
  const { ideas } = useAppServices();
  const { account } = useIdentity();
  const scope = useScope();
  return useQuery<MyIdeas>({
    queryKey: ideaKeys.mine(scope),
    queryFn: ({ signal }) => ideas.mine({ signal }),
    enabled: enabled && ideas.supported && Boolean(account),
    staleTime: 60_000,
    retry,
  });
}

/**
 * Procurar as parecidas, mandar e somar o pedido, com a lista guardada
 * atualizada na hora: a sugestão nova aparece em "Minhas sugestões" sem
 * esperar a próxima busca.
 */
export function useIdeaActions() {
  const { ideas } = useAppServices();
  const queryClient = useQueryClient();
  const scope = useScope();

  const put = useCallback(
    (idea: MyIdea) => {
      queryClient.setQueryData<MyIdeas>(ideaKeys.mine(scope), current =>
        current ? withIdea(current, idea) : current,
      );
      void queryClient.invalidateQueries({ queryKey: ideaKeys.mine(scope) });
    },
    [queryClient, scope],
  );

  const similar = useCallback(
    (draft: IdeaDraft): Promise<SimilarIdea[]> => ideas.similar(draft),
    [ideas],
  );

  const submit = useCallback(
    async (draft: IdeaDraft, seenSimilar: readonly number[]) => {
      const idea = await ideas.submit(draft, seenSimilar);
      put(idea);
      return idea;
    },
    [ideas, put],
  );

  const vote = useCallback(
    async (issue: number) => {
      const idea = await ideas.vote(issue);
      put(idea);
      return idea;
    },
    [ideas, put],
  );

  /** Quantas o aluno ainda manda hoje, se a lista já foi lida. */
  const remainingToday = useCallback(
    () =>
      queryClient.getQueryData<MyIdeas>(ideaKeys.mine(scope))?.remainingToday ??
      null,
    [queryClient, scope],
  );

  return { similar, submit, vote, remainingToday };
}
