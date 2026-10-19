import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import type { AttendedClassesSchedule } from '../domain/models';
import { normalizeSubjectId, subjectKey } from '../domain/rules/subjectId';
import { academicKeys } from './queryKeys';

const DETAILS_STALE = 6 * 60 * 60 * 1000;
/** Leituras ao mesmo tempo no portal. */
const CONCURRENCY = 2;
/** Depois disso, a imagem sai com os professores que já chegaram. */
const DEADLINE = 10_000;

export type SubjectTeachers = ReadonlyMap<string, readonly string[]>;

/**
 * Professores de cada disciplina da grade, na turma do aluno, lidos na
 * Pesquisa de Disciplinas pelo mesmo cache dela, do Gerador e do plano. O que
 * falhar ou passar do prazo fica sem professor: a imagem não espera o portal.
 */
export function useSubjectTeachers() {
  const { academicRecords } = useAppServices();
  const { account } = useIdentity();
  const queryClient = useQueryClient();
  const scope = account?.scope;
  const period = account?.period ?? '';

  return useCallback(
    async (
      items: readonly AttendedClassesSchedule[],
    ): Promise<SubjectTeachers> => {
      const teachers = new Map<string, readonly string[]>();
      if (!scope) return teachers;
      const subjects = new Map<string, { id: string; turma: number }>();
      for (const item of items) {
        const id = item.class?.id ?? item.subject_id;
        const turma = Number(item.class?.class);
        if (!id || !Number.isFinite(turma)) continue;
        const key = subjectKey(id);
        if (!subjects.has(key)) subjects.set(key, { id, turma });
      }

      const controller = new AbortController();
      const queue = [...subjects.entries()];
      const read = async ([key, { id, turma }]: (typeof queue)[number]) => {
        const details = await queryClient.fetchQuery({
          queryKey: academicKeys.details(scope, period, normalizeSubjectId(id)),
          queryFn: ({ signal }) => {
            const request = new AbortController();
            const abort = () => request.abort();
            signal.addEventListener('abort', abort);
            controller.signal.addEventListener('abort', abort);
            return academicRecords
              .getSubjectDetails(id, { signal: request.signal })
              .finally(() => {
                signal.removeEventListener('abort', abort);
                controller.signal.removeEventListener('abort', abort);
              });
          },
          staleTime: DETAILS_STALE,
          retry: false,
          // sem rede, a página falha na hora em vez de esperar a conexão
          networkMode: 'always',
        });
        const names = (
          details.classes?.find(item => item.classNumber === turma)?.teachers ??
          []
        ).filter(Boolean);
        if (names.length) teachers.set(key, names);
      };
      const worker = async () => {
        while (queue.length && !controller.signal.aborted) {
          const next = queue.shift() as (typeof queue)[number];
          await read(next).catch(() => undefined);
        }
      };

      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<void>(resolve => {
        timer = setTimeout(resolve, DEADLINE);
      });
      await Promise.race([
        Promise.all(
          Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker),
        ),
        deadline,
      ]);
      clearTimeout(timer);
      controller.abort();
      return new Map(teachers);
    },
    [academicRecords, period, queryClient, scope],
  );
}
