import React, { useMemo, useState } from 'react';
import { useTheme } from 'styled-components/native';
import { useQuery, useMutation } from '@tanstack/react-query';

import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { errorMessage, isTransientError } from '@root/shared/errors/AppError';
import type { AttendedSubjectInfo } from '@root/modules/academics/domain/models';
import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import { useOnlineStatus } from '@root/modules/academics/presentation/useOnlineStatus';
import { communityKeys } from '@root/modules/community/presentation/queryKeys';
import { MAX_MESSAGE_LENGTH } from '@root/modules/community/domain/models';
import {
  ErrorState,
  Icon,
  IconButton,
  SelectField,
  Text,
  TextField,
  snackbar,
} from '@components/ui';
import { ScreenPanel } from '@templates/ScreenPanel';

import { ChatMessages, ChatSkeleton } from '../ChatMessages';
import { groupByDay, isOwnMessage } from '../chatFormat';
import {
  messagePeriodOptions,
  portalPeriod,
  suggestedPeriod,
} from '../messagePeriod';
import { useToday } from '../useToday';
import {
  ChatMeta,
  Composer,
  Hint,
  HintText,
  NoticeSlot,
  styles,
} from './SubjectChat.styles';

const HINT =
  'Compartilhe informações da turma, como grupos, links, materiais e datas de prova.';

/**
 * Conversa da turma no mural: nome e código · turma no topo fixo, seletor do
 * período, mensagens agrupadas por dia e o compositor fixo no rodapé.
 */
export const SubjectChat = (subject: AttendedSubjectInfo) => {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [sentCount, setSentCount] = useState(0);
  const { community } = useAppServices();
  const { account } = useIdentity();
  const online = useOnlineStatus();
  // muda na virada do dia: a conversa pode ficar aberta de um dia para o outro
  const today = useToday();
  const fromPortal = portalPeriod(account);
  const suggested = suggestedPeriod(today);
  const [period, setPeriod] = useState(fromPortal ?? suggested);
  const periodOptions = messagePeriodOptions(period, today).map(value => ({
    value,
    label: value,
    aside:
      value === fromPortal
        ? 'Atual'
        : !fromPortal && value === suggested
          ? 'Sugestão'
          : undefined,
  }));
  const isSuggestion = !fromPortal && period === suggested;
  const thread = {
    subjectId: subject.id,
    classNumber: String(subject.class),
    period,
  };
  const query = useQuery({
    queryKey: communityKeys.messages(account?.scope ?? 'signed-out', thread),
    queryFn: ({ signal }) => community.messages(thread, { signal }),
    enabled: Boolean(account),
    retry: (count, error) => count < 1 && isTransientError(error),
  });
  const { mutate, isPending: sending } = useMutation({
    mutationFn: (messageText: string) =>
      community.postMessage(thread, messageText),
    onSuccess: (_, sentText) => {
      // o campo segue editável durante o envio: sai do campo só o texto
      // enviado, e o que foi digitado nesse meio-tempo fica
      setText(current =>
        current.startsWith(sentText) ? current.slice(sentText.length) : current,
      );
      // a conversa volta ao fim e acompanha a mensagem nova quando ela chegar
      setSentCount(count => count + 1);
      void query.refetch();
    },
    onError: error => snackbar.error(errorMessage(error)),
  });
  // Contra o envio duplo, o botão fica em carregamento (desabilitado) e esta
  // checagem ignora outro envio; o campo não é desabilitado, o que tiraria o
  // foco e fecharia o teclado a cada mensagem.
  const handleSendMessage = () => {
    if (text.trim() && !sending) mutate(text);
  };
  const retry = () => {
    void query.refetch();
  };

  const messages = query.data;
  const hasData = messages !== undefined;
  const groups = useMemo(
    () => groupByDay(messages ?? [], today),
    [messages, today],
  );
  const isMine = (message: { authorName: string }) =>
    isOwnMessage(message, account?.name);

  const showNotice =
    query.isPaused || !online || (Boolean(query.error) && hasData);

  let placeholder: React.ReactNode;
  if (!hasData) {
    if (query.isError) {
      placeholder = (
        <ErrorState message={errorMessage(query.error)} onRetry={retry} />
      );
    } else if (query.fetchStatus === 'fetching') {
      placeholder = <ChatSkeleton />;
    } else {
      // sem conexão (o aviso acima explica) ou sem conta
      placeholder = null;
    }
  } else if (messages.length === 0) {
    placeholder = (
      <Hint dashed padding={14}>
        <Icon name="lightbulb" color={theme.colors.accent} />
        <HintText tone="muted">{HINT}</HintText>
      </Hint>
    );
  }

  const header = (
    <>
      <Text variant="titleS" accessibilityRole="header">
        {subject.name}
      </Text>
      <ChatMeta variant="meta" tone="muted">
        {subject.id} · Turma {subject.class ?? '(?)'}
      </ChatMeta>
      <SelectField
        label="Período das mensagens"
        icon="date_range"
        options={periodOptions}
        value={period}
        valueLabel={period}
        aside={isSuggestion ? 'Sugestão' : ''}
        onChange={setPeriod}
        disabled={sending}
        accessibilityLabel={`Período das mensagens: ${period}${
          isSuggestion ? ', sugestão pelo calendário; confirme o período' : ''
        }. Trocar`}
      />
    </>
  );

  const composer = (
    <Composer>
      <TextField
        multiline
        onChangeText={setText}
        value={text}
        maxLength={MAX_MESSAGE_LENGTH}
        placeholder="Digite aqui sua mensagem"
        accessibilityLabel="Mensagem"
        onSubmitEditing={handleSendMessage}
        containerStyle={styles.composerField}
        inputStyle={styles.composerInput}
      />
      <IconButton
        variant="filled"
        icon="send"
        accessibilityLabel="Enviar mensagem"
        onPress={handleSendMessage}
        loading={sending}
        disabled={!text.trim()}
      />
    </Composer>
  );

  return (
    // o compositor sobe com o teclado junto com o rodapé do painel
    <ScreenPanel
      scroll={false}
      header={header}
      headerStyle={styles.header}
      footer={composer}
      updating={hasData && query.isFetching}
    >
      {showNotice ? (
        <NoticeSlot>
          <QueryNotice
            isPaused={query.isPaused}
            isFetching={false}
            error={query.error}
            hasData={hasData}
            retry={retry}
            dataUpdatedAt={query.dataUpdatedAt || undefined}
          />
        </NoticeSlot>
      ) : null}
      <ChatMessages
        groups={groups}
        isMine={isMine}
        placeholder={placeholder}
        followKey={`${period}:${sentCount}`}
      />
    </ScreenPanel>
  );
};
