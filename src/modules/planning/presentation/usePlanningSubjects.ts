import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import {
  CurriculumSubject,
  SubjectsTaken,
} from '@root/modules/academics/domain/models';
import { academicKeys } from '@root/modules/academics/presentation/queryKeys';
import { normalizeSubjectId } from '@root/modules/academics/domain/rules/subjectId';
import {
  LoadPlanningSubjects,
  PlanningLoadProgress,
} from '../application/LoadPlanningSubjects';

export function usePlanningSubjects(
  subjects: CurriculumSubject[],
  history?: SubjectsTaken[],
) {
  const { academicRecords } = useAppServices();
  const { account } = useIdentity();
  const queryClient = useQueryClient();
  const [attempt, setAttempt] = useState(0);
  const scope = account?.scope;
  const period = account?.period;
  const canLoad = Boolean(scope && period && history);
  const [progress, setProgress] = useState<PlanningLoadProgress>({
    completed: 0,
    total: subjects.length,
    results: [],
  });
  const [loading, setLoading] = useState(canLoad);
  // Uma carga nova zera o progresso já no render; o efeito só busca.
  const inputs = [
    academicRecords,
    queryClient,
    scope,
    period,
    subjects,
    history,
    attempt,
  ];
  const [loadedFor, setLoadedFor] = useState(inputs);
  if (inputs.some((input, i) => input !== loadedFor[i])) {
    setLoadedFor(inputs);
    setProgress({ completed: 0, total: subjects.length, results: [] });
    setLoading(canLoad);
  }
  useEffect(() => {
    if (!scope || !period || !history) return;
    const controller = new AbortController();
    const loader = new LoadPlanningSubjects({
      getSubjectDetails: (subjectId, options) =>
        queryClient.fetchQuery({
          queryKey: academicKeys.details(
            scope,
            period,
            normalizeSubjectId(subjectId),
          ),
          queryFn: ({ signal }) => {
            const request = new AbortController();
            const abort = () => request.abort();
            const sources = [signal, options?.signal].filter(
              (source): source is AbortSignal => Boolean(source),
            );
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
          staleTime: 6 * 60 * 60 * 1000,
          retry: false,
        }),
    });
    void loader
      .execute(subjects, history, controller.signal, setProgress)
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [academicRecords, queryClient, scope, period, subjects, history, attempt]);
  return { ...progress, loading, retry: () => setAttempt(value => value + 1) };
}
