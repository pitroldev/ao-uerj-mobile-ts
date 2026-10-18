import { useMemo } from 'react';
import { subjectLoads } from '../domain/rules/subjectLoads';
import { useCurriculum, useHistory, useUniversalSubjects } from './queries';

/**
 * Créditos e carga horária das disciplinas, pelo histórico, pelo currículo e
 * pelas universais (que o app guarda por 24 horas). Use só onde eles
 * aparecem: sem os dados salvos, o primeiro uso busca as páginas no Aluno
 * Online.
 */
export function useSubjectLoads() {
  const history = useHistory();
  const curriculum = useCurriculum();
  const universal = useUniversalSubjects();
  const loads = useMemo(
    () =>
      subjectLoads(
        history.data ?? [],
        curriculum.data ?? [],
        universal.data ?? [],
      ),
    [history.data, curriculum.data, universal.data],
  );
  const sources = [history, curriculum, universal];
  return {
    loads,
    history,
    /** Alguma fonte ainda sem resposta. */
    loading: sources.some(source => source.isLoading),
    /** Alguma fonte falhou (as outras podem ter respondido). */
    failed: sources.some(source => source.error),
    retry: () => {
      for (const source of sources) {
        if (source.error) void source.refetch();
      }
    },
  };
}
