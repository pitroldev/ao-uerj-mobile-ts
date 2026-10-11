import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { isTransientError, AppError } from '@root/shared/errors/AppError';
import { AcademicRequestOptions } from '../application/ports';
import { ReadAcademicRecords } from '../application/use-cases/ReadAcademicRecords';
import { normalizeSubjectId } from '../domain/rules/subjectId';
import { academicKeys } from './queryKeys';

const HOUR = 60 * 60 * 1000;

function useRecords() {
  const { academicRecords } = useAppServices();
  return useMemo(
    () => new ReadAcademicRecords(academicRecords),
    [academicRecords],
  );
}

function useAcademicQuery<T>(
  resource: string,
  read: (options: AcademicRequestOptions) => Promise<T>,
  staleHours: number,
  extraKey?: string,
  enabled = true,
) {
  const { account, status } = useIdentity();
  const baseKey = academicKeys.resource(
    account?.scope ?? 'signed-out',
    account?.period ?? '',
    resource,
  );
  return useQuery({
    queryKey: extraKey === undefined ? baseKey : [...baseKey, extraKey],
    queryFn: ({ signal }) => {
      if (!account || (status !== 'signedIn' && status !== 'refreshing')) {
        throw new AppError('NOT_LOGGED_IN');
      }
      return read({ signal });
    },
    enabled:
      enabled &&
      Boolean(account) &&
      (status === 'signedIn' || status === 'refreshing'),
    staleTime: staleHours * HOUR,
    gcTime: 7 * 24 * HOUR,
    retry: (count, error) => count < 1 && isTransientError(error),
  });
}

export function useGrades() {
  return useAcademicQuery('grades', useRecords().grades, 6);
}
export function useHistory() {
  return useAcademicQuery('history', useRecords().history, 24);
}
export function useCurriculum() {
  return useAcademicQuery('curriculum', useRecords().curriculum, 24);
}
export function useSchedule() {
  return useAcademicQuery('schedule', useRecords().schedule, 12);
}
export function usePartialRid() {
  return useAcademicQuery('partial-rid', useRecords().partialRid, 1);
}
export function useUniversalSubjects() {
  return useAcademicQuery(
    'universal-subjects',
    useRecords().universalSubjects,
    24,
  );
}
export function useSubjectDetails(subjectId?: string) {
  const records = useRecords();
  let cacheId = subjectId ?? '';
  try {
    if (subjectId) cacheId = normalizeSubjectId(subjectId);
  } catch {
    /* Invalid input is reported by the query, not during render. */
  }
  return useAcademicQuery(
    'subject-details',
    options => records.subjectDetails(subjectId ?? '', options),
    6,
    cacheId,
    Boolean(subjectId),
  );
}

export function isPortalBlocked(error: unknown): boolean {
  return error instanceof AppError && error.code === 'POSSIBLY_BLOCKED';
}
