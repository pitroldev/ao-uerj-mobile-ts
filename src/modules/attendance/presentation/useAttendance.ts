import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { ATTENDANCE_KEY } from '../application/AttendanceRecords';
import {
  absenceKey,
  type Absence,
  type ClassMeeting,
} from '../domain/attendance';

const NONE: Absence[] = [];

/**
 * Faltas da conta ativa no período atual (só no aparelho), o conjunto de
 * chaves para saber se uma aula tem falta e a ação de marcar ou desmarcar.
 */
export function useAttendance() {
  const { attendance, identity } = useAppServices();
  const { account } = useIdentity();
  const queryClient = useQueryClient();
  const scope = account?.scope;
  const period = account?.period ?? 'current';
  const queryKey = useMemo(
    () => ['preferences', scope ?? 'signed-out', ATTENDANCE_KEY, period],
    [scope, period],
  );
  const query = useQuery({
    queryKey,
    queryFn: () => attendance.read(scope as string, period),
    enabled: Boolean(scope),
    // a leitura é do aparelho: sem rede (na sala de aula) as faltas aparecem
    networkMode: 'always',
    staleTime: Infinity,
    retry: false,
  });
  const absences = query.data ?? NONE;
  const keys = useMemo(() => new Set(absences.map(absenceKey)), [absences]);

  /** Devolve `false` se não gravou (outra conta entrou ou o disco falhou). */
  const mark = useCallback(
    async (meeting: ClassMeeting, absent: boolean) => {
      if (!scope || identity.getSnapshot().account?.scope !== scope) {
        return false;
      }
      try {
        const next = await attendance.mark(scope, period, meeting, absent);
        if (identity.getSnapshot().account?.scope !== scope) return false;
        queryClient.setQueryData(queryKey, next);
        return true;
      } catch {
        return false;
      }
    },
    [attendance, identity, period, queryClient, queryKey, scope],
  );

  return { absences, keys, mark };
}
