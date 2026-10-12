import { useMemo } from 'react';
import { useElectiveCreditsConfig } from '@hooks/useElectiveCreditsConfig';
import {
  useCurriculum,
  useHistory,
} from '@root/modules/academics/presentation/queries';
import {
  calculateAcademicProgress,
  calculateCraProgression,
} from '@root/modules/academics/domain/rules/progress';
import { crChartPoints } from './crChartModel';

export function useMyProgress() {
  const subjectsTakenQuery = useHistory();
  const curriculumQuery = useCurriculum();
  const electiveCreditsHook = useElectiveCreditsConfig();
  const progress = useMemo(
    () =>
      calculateAcademicProgress(
        subjectsTakenQuery.data ?? [],
        curriculumQuery.data ?? [],
        electiveCreditsHook.config,
      ),
    [subjectsTakenQuery.data, curriculumQuery.data, electiveCreditsHook.config],
  );
  const cra = useMemo(
    () => calculateCraProgression(subjectsTakenQuery.data ?? []),
    [subjectsTakenQuery.data],
  );
  const crPoints = useMemo(
    () => crChartPoints(cra.pointsOverTime, subjectsTakenQuery.data ?? []),
    [cra.pointsOverTime, subjectsTakenQuery.data],
  );
  return {
    initialLoading: subjectsTakenQuery.isLoading || curriculumQuery.isLoading,
    isEmpty: !subjectsTakenQuery.data?.length && !curriculumQuery.data?.length,
    curriculumAvailable: curriculumQuery.data !== undefined,
    ...progress,
    ...cra,
    crPoints,
    electiveCreditsHook,
    dataUpdatedAt: Math.min(
      subjectsTakenQuery.dataUpdatedAt,
      curriculumQuery.dataUpdatedAt,
    ),
    error: subjectsTakenQuery.error || curriculumQuery.error,
    isPaused: subjectsTakenQuery.isPaused || curriculumQuery.isPaused,
    isFetching: subjectsTakenQuery.isFetching || curriculumQuery.isFetching,
    retry: () =>
      Promise.all([subjectsTakenQuery.refetch(), curriculumQuery.refetch()]),
  };
}
