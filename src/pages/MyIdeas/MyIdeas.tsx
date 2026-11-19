import React, { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import styled from 'styled-components/native';

import {
  Button,
  EmptyState,
  ErrorState,
  List,
  ListRow,
  Notice,
  SkeletonList,
  Tag,
  Text,
  snackbar,
} from '@components/ui';
import { ScreenPanel } from '@templates/ScreenPanel';
import { useHeaderBack } from '@templates/Header/headerStore';
import { useBackHandler } from '@hooks/useBackHandler';
import { SuggestIdeaSheet } from '@features/Ideas/SuggestIdeaSheet';
import { proofWaitText } from '@features/HowItWorks/HowItWorksSheet';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { useDelayedMoment } from '@root/modules/delivery/presentation/positiveMoments';
import { newlyDone, type MyIdea } from '@root/modules/ideas/domain/ideas';
import {
  ideaLabel,
  ideaMeta,
  ideasErrorMessage,
  STATUS_TEXT,
} from '@root/modules/ideas/presentation/ideasText';
import {
  useIdeasState,
  useMyIdeas,
} from '@root/modules/ideas/presentation/useIdeas';
import { AppError } from '@root/shared/errors/AppError';
import type { RootDrawerParamList } from '@root/routes';

/** A feita nova aparece na lista antes da folha de avaliação da loja. */
const DONE_MOMENT_MS = 2_500;

const Top = styled.View`
  margin-bottom: ${({ theme }) => theme.layout.gutter}px;
`;

function IdeaRow({
  idea,
  fresh,
  onOpen,
}: {
  idea: MyIdea;
  /** Virou "Feita" desde a última visita: fica em destaque. */
  fresh: boolean;
  onOpen: (url: string) => void;
}) {
  const status = STATUS_TEXT[idea.status];
  const meta = ideaMeta(idea);
  const issue = idea.issue;
  return (
    <ListRow
      title={idea.title}
      titleWeight="medium"
      leadingIcon={idea.kind === 'joined' ? 'thumb_up' : 'lightbulb'}
      leadingAlign="start"
      facts={
        <>
          <Tag tone={status.tone} icon={status.icon} label={status.label} />
          {meta ? (
            <Text variant="meta" tone="muted">
              {meta}
            </Text>
          ) : null}
        </>
      }
      highlighted={fresh}
      external={Boolean(issue)}
      onPress={issue ? () => onOpen(issue.url) : undefined}
      accessibilityRole={issue ? 'link' : undefined}
      accessibilityLabel={`${fresh ? 'Novidade. ' : ''}${ideaLabel(idea)}`}
      accessibilityHint={issue ? 'Abre no GitHub' : undefined}
    />
  );
}

/**
 * "Minhas sugestões": as ideias que o aluno mandou e os pedidos que ele
 * somou, com o estado de cada uma no GitHub. A que virou "Feita" desde a
 * última visita fica em destaque (e é um momento bom).
 */
export function MyIdeasPage() {
  const navigation =
    useNavigation<
      DrawerNavigationProp<RootDrawerParamList, 'Minhas sugestões'>
    >();
  const goBack = useCallback(() => navigation.navigate('Sobre'), [navigation]);
  useHeaderBack(goBack, 'Voltar para Sobre');
  useBackHandler(goBack);

  const { ideas } = useAppServices();
  const { account } = useIdentity();
  const state = useIdeasState();
  const query = useMyIdeas();
  const [writing, setWriting] = useState(false);
  const doneMoment = useDelayedMoment(DONE_MOMENT_MS);

  const { data, refetch } = query;
  // as feitas já vistas quando o aluno chegou: as outras ficam em destaque
  // nesta visita, mesmo depois de o aparelho marcá-las como vistas. A tela
  // do menu não desmonta, então a visita acaba quando ela sai da frente
  const ready = Boolean(account) && state.scope === account?.scope;
  const [seenBefore, setSeenBefore] = useState<readonly string[] | null>(null);
  if (ready && seenBefore === null) setSeenBefore(state.seenDone);
  useFocusEffect(useCallback(() => () => setSeenBefore(null), []));
  const fresh =
    data && seenBefore
      ? newlyDone(data.ideas, seenBefore).map(idea => idea.id)
      : [];
  const freshKey = fresh.join(' ');
  useEffect(() => {
    if (!freshKey) return;
    ideas.markSeen(freshKey.split(' ')).catch(() => undefined);
    doneMoment();
  }, [freshKey, ideas, doneMoment]);

  const open = (url: string) => {
    Linking.openURL(url).catch(() => {
      snackbar.error('Não foi possível abrir este link.');
    });
  };
  const retry = () => {
    void refetch();
  };
  const suggest = () => setWriting(true);

  const proofMissing =
    query.error instanceof AppError &&
    query.error.code === 'STUDENT_PROOF_UNAVAILABLE';

  let content: React.ReactNode;
  if (query.isLoading && !data) {
    content = (
      <SkeletonList count={3} accessibilityLabel="Carregando suas sugestões…" />
    );
  } else if (proofMissing && !data) {
    content = (
      <EmptyState
        icon="lock"
        title="Confirmando que você é aluno"
        text={proofWaitText()}
        action={{ label: 'Tentar de novo', icon: 'refresh', onPress: retry }}
      />
    );
  } else if (!data) {
    content = (
      <ErrorState message={ideasErrorMessage(query.error)} onRetry={retry} />
    );
  } else if (!data.ideas.length) {
    content = (
      <EmptyState
        icon="lightbulb"
        text="Você ainda não mandou nenhuma ideia."
        action={{ label: 'Sugerir uma ideia', icon: 'add', onPress: suggest }}
      />
    );
  } else {
    content = (
      <>
        {query.isError ? (
          <Top>
            <Notice
              kind="refreshFailed"
              text={ideasErrorMessage(query.error)}
              onRetry={retry}
            />
          </Top>
        ) : null}
        <List>
          {data.ideas.map(idea => (
            <IdeaRow
              key={idea.id}
              idea={idea}
              fresh={fresh.includes(idea.id)}
              onOpen={open}
            />
          ))}
        </List>
      </>
    );
  }

  return (
    <ScreenPanel
      refreshing={query.isRefetching}
      onRefresh={data ? retry : undefined}
      footer={
        data?.ideas.length ? (
          <Button
            icon="lightbulb"
            label="Sugerir uma ideia"
            onPress={suggest}
          />
        ) : undefined
      }
    >
      {content}
      <SuggestIdeaSheet visible={writing} onClose={() => setWriting(false)} />
    </ScreenPanel>
  );
}
