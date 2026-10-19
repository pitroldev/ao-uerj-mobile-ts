import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isCancelledError,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useElectiveCreditsConfig } from '@hooks/useElectiveCreditsConfig';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { normalizeSubjectId } from '@root/modules/academics/domain/rules/subjectId';
import {
  useCurriculum,
  useHistory,
  useSchedule,
  useSynthesis,
} from '@root/modules/academics/presentation/queries';
import { academicKeys } from '@root/modules/academics/presentation/queryKeys';
import { AppError } from '@root/shared/errors/AppError';
import {
  DEFAULT_PLAN_PREFERENCES,
  PLAN_PREFERENCES_KEY,
  type PlanPreferences,
} from '../application/PlanPreferencesStore';
import {
  PREREQUISITES_KEY,
  type CatalogProgress,
  type PrerequisiteEntries,
} from '../application/PrerequisiteCatalog';
import {
  planInputs,
  planSubject,
  postponementAt,
  postponementIndexes,
} from '../application/planInputs';
import {
  buildGraduationPlan,
  deadlineSlack,
  PACE_CREDITS,
  type Pace,
} from '../domain/plan';
import { periodAfter } from '../domain/periods';

const DETAILS_STALE = 6 * 60 * 60 * 1000;
const NO_ENTRIES: PrerequisiteEntries = {};

/** Ritmo e adiamentos da conta, lidos do aparelho (também sem rede). */
function usePlanPreferences() {
  const { graduation, identity } = useAppServices();
  const { account } = useIdentity();
  const queryClient = useQueryClient();
  const scope = account?.scope;
  const queryKey = useMemo(
    () => ['preferences', scope ?? 'signed-out', PLAN_PREFERENCES_KEY],
    [scope],
  );
  const query = useQuery({
    queryKey,
    queryFn: () => graduation.preferences.read(scope as string),
    enabled: Boolean(scope),
    networkMode: 'always',
    staleTime: Infinity,
    retry: false,
  });
  const change = useCallback(
    async (update: (current: PlanPreferences) => PlanPreferences) => {
      if (!scope || identity.getSnapshot().account?.scope !== scope) return;
      try {
        const next = await graduation.preferences.change(scope, update);
        if (identity.getSnapshot().account?.scope === scope) {
          queryClient.setQueryData(queryKey, next);
        }
      } catch {
        // a escolha volta a valer na próxima tentativa
      }
    },
    [graduation, identity, queryClient, queryKey, scope],
  );
  return { preferences: query.data ?? DEFAULT_PLAN_PREFERENCES, change };
}

type CatalogState = Omit<CatalogProgress, 'entries'> & { loading: boolean };

function keyOf(id: string): string | null {
  try {
    return normalizeSubjectId(id);
  } catch {
    return null;
  }
}

/**
 * Os pré-requisitos guardados e, com `load`, a leitura dos que faltam. As
 * leituras ficam numa query das preferências, a mesma do cartão do Meu
 * Progresso e da tela do plano (as duas continuam montadas no menu). As
 * páginas passam pelo cache da Pesquisa de Disciplinas e do Gerador.
 * `ready`: as fontes do plano chegaram (a versão curricular, se houver, já
 * é conhecida).
 */
function usePrerequisiteCatalog(
  subjectIds: readonly string[],
  curriculum: string | null,
  ready: boolean,
  load: boolean,
) {
  const { graduation, academicRecords } = useAppServices();
  const { account } = useIdentity();
  const queryClient = useQueryClient();
  const scope = account?.scope;
  const period = account?.period ?? '';
  const storedKey = useMemo(
    () => ['preferences', scope ?? 'signed-out', PREREQUISITES_KEY, curriculum],
    [curriculum, scope],
  );
  const stored = useQuery({
    queryKey: storedKey,
    queryFn: () => graduation.prerequisites.read(scope as string, curriculum),
    // com `load`, a própria leitura preenche a query
    enabled: Boolean(scope) && ready && !load,
    networkMode: 'always',
    staleTime: Infinity,
    retry: false,
  });
  const [attempt, setAttempt] = useState(0);
  // "ler de novo" passa por cima do cache das páginas da Pesquisa
  const fresh = useRef(false);
  const [state, setState] = useState<CatalogState>({
    done: 0,
    total: 0,
    failed: [],
    stoppedBy: null,
    loading: true,
  });

  useEffect(() => {
    if (!load || !scope || !ready) return;
    let active = true;
    const controller = new AbortController();
    const staleTime = fresh.current ? 0 : DETAILS_STALE;
    fresh.current = false;
    const fetchOnce = (subjectId: string, signal: AbortSignal) =>
      queryClient.fetchQuery({
        queryKey: academicKeys.details(
          scope,
          period,
          normalizeSubjectId(subjectId),
        ),
        queryFn: ({ signal: querySignal }) => {
          const request = new AbortController();
          const abort = () => request.abort();
          const sources = [querySignal, signal];
          sources.forEach(source => {
            if (source.aborted) request.abort();
            else source.addEventListener('abort', abort);
          });
          return academicRecords
            .getSubjectDetails(subjectId, { signal: request.signal })
            .finally(() =>
              sources.forEach(source =>
                source.removeEventListener('abort', abort),
              ),
            );
        },
        staleTime,
        retry: false,
        // sem rede, a página falha na hora (e a leitura para com o aviso)
        networkMode: 'always',
      });
    // o React Query junta pedidos iguais: uma leitura anterior, cancelada,
    // pode levar junto a página em curso. Sem o cancelamento ser desta, lê de novo.
    const fetchDetails = (subjectId: string, signal: AbortSignal) =>
      fetchOnce(subjectId, signal).catch((error: unknown) => {
        const cancelled =
          isCancelledError(error) ||
          (error instanceof AppError && error.code === 'CANCELLED');
        if (!cancelled || signal.aborted) throw error;
        return fetchOnce(subjectId, signal);
      });
    graduation.prerequisites
      .load(
        scope,
        curriculum,
        subjectIds,
        fetchDetails,
        controller.signal,
        ({ entries, ...progress }) => {
          if (!active) return;
          queryClient.setQueryData(storedKey, entries);
          // sem nada a ler, a tela continua no plano (sem piscar a leitura)
          setState(current => ({
            ...progress,
            loading: current.loading || progress.total > 0,
          }));
        },
      )
      .then(({ entries, ...progress }) => {
        if (!active) return;
        queryClient.setQueryData(storedKey, entries);
        setState({ ...progress, loading: false });
      })
      .catch(() => {
        if (active) setState(current => ({ ...current, loading: false }));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    academicRecords,
    attempt,
    curriculum,
    graduation,
    load,
    period,
    queryClient,
    ready,
    scope,
    storedKey,
    subjectIds,
  ]);

  const entries = stored.data ?? NO_ENTRIES;
  // tudo já lido: o plano abre na hora, sem a tela da leitura
  const covered =
    stored.data !== undefined &&
    subjectIds.every(id => {
      const key = keyOf(id);
      return key === null || key in entries;
    });
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const reload = useCallback(async () => {
    if (scope) await graduation.prerequisites.forget(scope).catch(() => null);
    fresh.current = true;
    queryClient.setQueryData(storedKey, NO_ENTRIES);
    setState(current => ({ ...current, loading: true }));
    setAttempt(value => value + 1);
  }, [graduation, queryClient, scope, storedKey]);
  return {
    ...state,
    entries,
    loading: load ? state.loading && !covered : stored.data === undefined,
    retry,
    reload,
  };
}

type DeadlineLevel = 'good' | 'warn' | 'bad';

/**
 * O plano até a formatura da conta: as obrigatórias que faltam distribuídas
 * pelos próximos períodos, as vagas de eletiva, o prazo da Síntese e as
 * escolhas do aluno (ritmo e adiamentos). Com `load`, lê os pré-requisitos
 * que faltam; sem ele (o cartão do Meu Progresso), usa só os guardados.
 */
export function useGraduationPlan({ load }: { load: boolean }) {
  const { account } = useIdentity();
  const curriculumQuery = useCurriculum();
  const historyQuery = useHistory();
  const scheduleQuery = useSchedule();
  const synthesisQuery = useSynthesis();
  const { config: electiveCredits } = useElectiveCreditsConfig();
  const { preferences, change } = usePlanPreferences();

  const curriculum = curriculumQuery.data;
  const history = historyQuery.data;
  const synthesis = synthesisQuery.data ?? null;
  const synthesisSettled =
    synthesisQuery.data !== undefined ||
    synthesisQuery.isError ||
    synthesisQuery.isPaused;
  const accountPeriod =
    account?.period && /^\d{4}\.[12]$/.test(account.period)
      ? account.period
      : null;
  const current = synthesis?.currentPeriod ?? accountPeriod;

  const inProgress = useMemo(
    () =>
      (scheduleQuery.data ?? [])
        .filter(item => item.class?.status !== 'CANCELED')
        .map(item => item.class?.id ?? item.subject_id),
    [scheduleQuery.data],
  );
  const inputs = useMemo(
    () =>
      curriculum && history
        ? planInputs({
            curriculum,
            history,
            inProgress,
            synthesis,
            electiveCredits,
          })
        : null,
    [curriculum, electiveCredits, history, inProgress, synthesis],
  );
  // pelo conteúdo: a mesma lista com outra referência não recomeça a leitura
  const toReadKey = inputs?.remaining.map(item => item.id).join('|') ?? '';
  const toRead = useMemo(
    () => (toReadKey ? toReadKey.split('|') : []),
    [toReadKey],
  );
  // a versão curricular separa as leituras (sem a Síntese, continua a guardada)
  const catalog = usePrerequisiteCatalog(
    toRead,
    synthesis?.curriculumVersion ?? null,
    Boolean(inputs) && synthesisSettled,
    load,
  );

  const subjects = useMemo(
    () =>
      inputs
        ? [
            ...inputs.remaining.map(item => planSubject(item, catalog.entries)),
            ...inputs.electives,
          ]
        : [],
    [catalog.entries, inputs],
  );
  const notBefore = useMemo(
    () => postponementIndexes(preferences.postponed, current),
    [current, preferences.postponed],
  );
  const planFor = useCallback(
    (extra?: ReadonlyMap<string, number>) =>
      buildGraduationPlan(subjects, {
        completed: inputs?.completed ?? new Set(),
        credits: inputs?.mandatoryCredits ?? 0,
        cap: PACE_CREDITS[preferences.pace],
        notBefore: extra ? new Map([...notBefore, ...extra]) : notBefore,
      }),
    [inputs, notBefore, preferences.pace, subjects],
  );
  const plan = useMemo(() => planFor(), [planFor]);
  // só os adiamentos de disciplinas que ainda faltam (uma cursada sai daqui)
  const postponed = useMemo(
    () =>
      new Map(
        [...notBefore].filter(([key]) =>
          subjects.some(item => item.key === key),
        ),
      ),
    [notBefore, subjects],
  );

  const label = useCallback(
    (index: number) =>
      (current && periodAfter(current, index + 1)) ??
      `${index + 1}º período do plano`,
    [current],
  );
  const remaining = synthesis?.periods.remaining ?? null;
  const slack = deadlineSlack(plan, remaining);
  let deadlineLevel: DeadlineLevel | null = null;
  if (slack !== null)
    deadlineLevel = slack > 0 ? 'good' : slack === 0 ? 'warn' : 'bad';

  // nomes de tudo o que o aluno já viu no currículo e no histórico
  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of [...(history ?? []), ...(curriculum ?? [])]) {
      try {
        map.set(normalizeSubjectId(item.id), item.name);
      } catch {
        // código fora do padrão: fica sem nome
      }
    }
    return map;
  }, [curriculum, history]);
  const inProgressKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const id of inProgress) {
      try {
        keys.add(normalizeSubjectId(id));
      } catch {
        // idem
      }
    }
    return keys;
  }, [inProgress]);

  const unread = subjects.filter(
    item => !item.placeholder && item.prerequisites === null,
  );

  const setPace = useCallback(
    (pace: Pace) => change(currentChoices => ({ ...currentChoices, pace })),
    [change],
  );
  /** Adia uma disciplina para depois do período em que ela está no plano. */
  const postpone = useCallback(
    (key: string) => {
      const index = plan.periodOf.get(key);
      if (index === undefined) return;
      return change(choices => ({
        ...choices,
        postponed: {
          ...choices.postponed,
          [key]: postponementAt(index + 1, current),
        },
      }));
    },
    [change, current, plan.periodOf],
  );
  const undo = useCallback(
    (key: string) =>
      change(choices => ({
        ...choices,
        postponed: Object.fromEntries(
          Object.entries(choices.postponed).filter(([item]) => item !== key),
        ),
      })),
    [change],
  );
  const reset = useCallback(
    () => change(choices => ({ ...choices, postponed: {} })),
    [change],
  );
  /** Quantos períodos o plano teria com a disciplina adiada (para a folha). */
  const postponePreview = useCallback(
    (key: string) => {
      const index = plan.periodOf.get(key);
      if (index === undefined) return null;
      return planFor(new Map([[key, index + 1]])).periods.length;
    },
    [plan.periodOf, planFor],
  );

  const loadingSources =
    (curriculumQuery.isLoading && !curriculum) ||
    (historyQuery.isLoading && !history);
  let status: 'loading' | 'error' | 'done' | 'reading' | 'ready' = 'ready';
  if (loadingSources || (inputs && !synthesisSettled)) status = 'loading';
  else if (!inputs) status = 'error';
  else if (!subjects.length) status = 'done';
  else if (catalog.loading) status = load ? 'reading' : 'loading';

  return {
    status,
    plan,
    subjects,
    names,
    completed: inputs?.completed ?? new Set<string>(),
    inProgress: inProgressKeys,
    label,
    current,
    pace: preferences.pace,
    postponed,
    synthesis,
    deadline:
      remaining === null
        ? null
        : {
            remaining,
            slack: slack as number,
            level: deadlineLevel!,
            last: current ? periodAfter(current, remaining) : null,
          },
    unread,
    catalog: {
      done: catalog.done,
      total: catalog.total,
      failed: catalog.failed,
      stoppedBy: catalog.stoppedBy,
      retry: catalog.retry,
      reload: catalog.reload,
    },
    error: curriculumQuery.error ?? historyQuery.error,
    retrySources: () => {
      void curriculumQuery.refetch();
      void historyQuery.refetch();
      void synthesisQuery.refetch();
    },
    setPace,
    postpone,
    undo,
    reset,
    postponePreview,
  };
}

export type GraduationPlanView = ReturnType<typeof useGraduationPlan>;
