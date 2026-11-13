import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { isTransientError, AppError } from '@root/shared/errors/AppError';
import { AcademicRequestOptions } from '../application/ports';
import { ReadAcademicRecords } from '../application/use-cases/ReadAcademicRecords';
import { normalizeSubjectId } from '../domain/rules/subjectId';
import type { IdentityController } from '@root/modules/identity/application/IdentityController';
import { showsAccount } from '@root/modules/identity/domain/identityState';
import type { Account } from '@root/modules/identity/domain/types';
import { academicKeys } from './queryKeys';

const HOUR = 60 * 60 * 1000;

/** Horas até cada leitura ficar velha e ser refeita ao abrir a tela. */
const STALE_HOURS = {
  grades: 6,
  history: 24,
  'complementary-activities': 24,
  curriculum: 24,
  schedule: 12,
  'partial-rid': 1,
  'universal-subjects': 24,
  synthesis: 24,
  'subject-details': 6,
} as const;

export type AcademicResource = keyof typeof STALE_HOURS;

type Identity = Pick<IdentityController, 'getSnapshot' | 'settled'>;
const SIGNED_OUT = { scope: 'signed-out', period: '' };

/**
 * A mesma consulta para a tela e para a busca antecipada: chave da conta e
 * do período, e a leitura só depois do login da abertura (a conta salva
 * aparece antes, com o cache).
 */
export function academicQueryOptions<T>(
  identity: Identity,
  owner: Pick<Account, 'scope' | 'period'>,
  resource: AcademicResource,
  read: (options: AcademicRequestOptions) => Promise<T>,
  extraKey?: string,
) {
  const baseKey = academicKeys.resource(owner.scope, owner.period, resource);
  return {
    queryKey:
      extraKey === undefined
        ? (baseKey as readonly unknown[])
        : [...baseKey, extraKey],
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      await identity.settled();
      const { status, account } = identity.getSnapshot();
      if (
        !account ||
        account.scope !== owner.scope ||
        (status !== 'signedIn' && status !== 'refreshing')
      )
        throw new AppError('NOT_LOGGED_IN');
      return read({ signal });
    },
    staleTime: STALE_HOURS[resource] * HOUR,
    // o cache em disco decide quanto tempo cada leitura vale; na memória,
    // até o logout
    gcTime: Infinity,
    retry: (count: number, error: unknown) =>
      count < 1 && isTransientError(error),
  };
}

function useRecords() {
  const { academicRecords } = useAppServices();
  return useMemo(
    () => new ReadAcademicRecords(academicRecords),
    [academicRecords],
  );
}

function useAcademicQuery<T>(
  resource: AcademicResource,
  read: (options: AcademicRequestOptions) => Promise<T>,
  extraKey?: string,
  enabled = true,
) {
  const { identity } = useAppServices();
  const { account, status } = useIdentity();
  return useQuery({
    ...academicQueryOptions(
      identity,
      account ?? SIGNED_OUT,
      resource,
      read,
      extraKey,
    ),
    enabled: enabled && showsAccount({ status, account }),
  });
}

export function useGrades() {
  return useAcademicQuery('grades', useRecords().grades);
}
export function useHistory() {
  return useAcademicQuery('history', useRecords().history);
}
/** Atividades complementares: a mesma página do histórico, lida junto. */
export function useComplementaryActivities() {
  return useAcademicQuery(
    'complementary-activities',
    useRecords().complementaryActivities,
  );
}
export function useCurriculum() {
  return useAcademicQuery('curriculum', useRecords().curriculum);
}
export function useSchedule() {
  return useAcademicQuery('schedule', useRecords().schedule);
}
export function usePartialRid() {
  return useAcademicQuery('partial-rid', useRecords().partialRid);
}
/** `enabled` falso adia a leitura (a lista é grande e nem toda tela a usa). */
export function useUniversalSubjects(enabled = true) {
  return useAcademicQuery(
    'universal-subjects',
    useRecords().universalSubjects,
    undefined,
    enabled,
  );
}
/** Síntese da Formação: muda pouco ao longo do período. */
export function useSynthesis() {
  return useAcademicQuery('synthesis', useRecords().synthesis);
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
    cacheId,
    Boolean(subjectId),
  );
}

/** Quantas páginas de disciplina o app pede ao portal ao mesmo tempo. */
const DETAILS_AT_ONCE = 3;
let detailsRunning = 0;
const detailsWaiting: Array<() => void> = [];

/** Fila das leituras de disciplina: o portal bloqueia quem pede demais junto. */
async function inDetailsTurn<T>(read: () => Promise<T>): Promise<T> {
  if (detailsRunning >= DETAILS_AT_ONCE)
    await new Promise<void>(resolve => detailsWaiting.push(resolve));
  detailsRunning += 1;
  try {
    return await read();
  } finally {
    detailsRunning -= 1;
    detailsWaiting.shift()?.();
  }
}

/**
 * Os detalhes de várias disciplinas, uma consulta por disciplina (a mesma do
 * `useSubjectDetails`, com o mesmo cache), no máximo três de cada vez. A
 * ordem do resultado é a de `subjectIds`.
 */
export function useSubjectDetailsList(subjectIds: readonly string[]) {
  const records = useRecords();
  const { identity } = useAppServices();
  const { account, status } = useIdentity();
  const owner = account ?? SIGNED_OUT;
  const enabled = showsAccount({ status, account });
  return useQueries({
    queries: subjectIds.map(subjectId => {
      let cacheId = subjectId;
      try {
        cacheId = normalizeSubjectId(subjectId);
      } catch {
        /* Invalid input is reported by the query, not during render. */
      }
      return {
        ...academicQueryOptions(
          identity,
          owner,
          'subject-details',
          options =>
            inDetailsTurn(() => records.subjectDetails(subjectId, options)),
          cacheId,
        ),
        enabled,
      };
    }),
  });
}

export function isPortalBlocked(error: unknown): boolean {
  return error instanceof AppError && error.code === 'POSSIBLY_BLOCKED';
}
