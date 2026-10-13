import React, { useState } from 'react';
import { useQueries } from '@tanstack/react-query';

import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import {
  isPortalBlocked,
  useSchedule,
} from '@root/modules/academics/presentation/queries';
import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import { useOnlineStatus } from '@root/modules/academics/presentation/useOnlineStatus';
import type { AttendedSubjectInfo } from '@root/modules/academics/domain/models';
import { communityKeys } from '@root/modules/community/presentation/queryKeys';
import { errorMessage } from '@root/shared/errors/AppError';
import {
  BlockedState,
  EmptyState,
  ErrorState,
  List,
  ListRow,
  SkeletonList,
} from '@components/ui';
import { ScreenPanel } from '@templates/ScreenPanel';

import { threadSummary } from '../chatFormat';
import { defaultMessagePeriod } from '../messagePeriod';
import { useToday } from '../useToday';
import { Lead } from './SubjectList.styles';

type Props = { onSubjectPress: (item: AttendedSubjectInfo) => void };

/** Disciplinas em curso (sem as canceladas), uma por turma. */
function attendedSubjects(
  schedule: { class: AttendedSubjectInfo }[] | undefined,
): AttendedSubjectInfo[] {
  return (schedule ?? []).reduce((acc, item) => {
    if (
      item.class.status !== 'CANCELED' &&
      !acc.some(
        subject =>
          subject.id === item.class.id && subject.class === item.class.class,
      )
    )
      acc.push(item.class);
    return acc;
  }, [] as AttendedSubjectInfo[]);
}

/**
 * Resumo das conversas já abertas neste uso do app ("5 mensagens · última em
 * 12/10/2026"). Só lê o cache da conversa (não faz requisições): disciplinas
 * cuja conversa ainda não foi aberta ficam sem a linha.
 */
function useCachedSummaries(subjects: AttendedSubjectInfo[]) {
  const { community } = useAppServices();
  const { account } = useIdentity();
  // o período sugerido acompanha a virada do dia, como na conversa
  const today = useToday();
  const period = defaultMessagePeriod(account, today);
  return useQueries({
    queries: subjects.map(subject => {
      const thread = {
        subjectId: subject.id,
        classNumber: String(subject.class),
        period,
      };
      return {
        queryKey: communityKeys.messages(
          account?.scope ?? 'signed-out',
          thread,
        ),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          community.messages(thread, { signal }),
        enabled: false,
      };
    }),
  }).map(result => (result.data ? threadSummary(result.data) : undefined));
}

/** Lista do mural: escolha a disciplina para abrir a conversa da turma. */
export const SubjectList = ({ onSubjectPress }: Props) => {
  const query = useSchedule();
  const online = useOnlineStatus();
  const [pulling, setPulling] = useState(false);
  const subjects = attendedSubjects(query.data);
  const summaries = useCachedSummaries(subjects);
  const hasData = query.data !== undefined;
  const retry = () => {
    void query.refetch();
  };
  const onRefresh = () => {
    // Sem conexão a consulta fica pausada e o refetch só termina quando a rede
    // volta: dispara sem prender o indicador, o aviso do topo explica.
    if (!online) {
      retry();
      return;
    }
    setPulling(true);
    void query.refetch().finally(() => setPulling(false));
  };

  let content: React.ReactNode;
  if (query.isLoading) {
    content = (
      <SkeletonList count={5} accessibilityLabel="Carregando disciplinas…" />
    );
  } else if (isPortalBlocked(query.error) && !hasData) {
    content = <BlockedState onRetry={retry} />;
  } else if (query.error && !hasData) {
    content = (
      <ErrorState
        message={errorMessage(query.error)}
        icon="error"
        onRetry={retry}
      />
    );
  } else if (!hasData) {
    // sem conexão e sem dados salvos: o aviso no topo explica
    content = null;
  } else if (subjects.length === 0) {
    content = (
      <EmptyState
        icon="forum"
        text="Parece que você não está inscrito em nenhuma disciplina no momento."
      />
    );
  } else {
    content = (
      <>
        <Lead tone="muted">
          Escolha a disciplina para abrir o mural da turma.
        </Lead>
        <List>
          {subjects.map((subject, index) => (
            <ListRow
              key={`${subject.id}-${subject.class}`}
              title={subject.name}
              code={subject.id}
              subtitle={`Turma ${subject.class}`}
              meta={summaries[index]}
              chevron
              accessibilityHint="Abre o mural da turma"
              onPress={() => onSubjectPress(subject)}
            />
          ))}
        </List>
      </>
    );
  }

  return (
    <ScreenPanel
      refreshing={pulling && !query.isPaused}
      onRefresh={hasData ? onRefresh : undefined}
    >
      <QueryNotice
        isPaused={query.isPaused}
        isFetching={query.isFetching && !pulling}
        error={query.error}
        hasData={hasData}
        retry={retry}
        dataUpdatedAt={query.dataUpdatedAt || undefined}
      />
      {content}
    </ScreenPanel>
  );
};
