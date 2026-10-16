import React, { useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import styled from 'styled-components/native';

import {
  BottomSheet,
  Button,
  EmptyState,
  List,
  ListRow,
  Notice,
  Section,
  SkeletonList,
  Text,
} from '@components/ui';
import { ScreenPanel } from '@templates/ScreenPanel';
import { errorMessage } from '@root/shared/errors/AppError';
import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import { useOnlineStatus } from '@root/modules/academics/presentation/useOnlineStatus';
import { useDocuments } from '@root/modules/documents/presentation/useDocuments';
import type { StudentDocument } from '@root/modules/documents/domain/models';

const Intro = styled(Text)`
  margin-bottom: ${({ theme }) => theme.spacing.xl}px;
`;
const Actions = styled.View`
  align-items: stretch;
  gap: ${({ theme }) => theme.spacing.xs}px;
  margin-top: ${({ theme }) => theme.spacing.sm}px;
`;
const SheetBody = styled.View`
  gap: ${({ theme }) => theme.spacing.lg}px;
`;
const StateNotice = styled(Notice)`
  margin-bottom: ${({ theme }) => theme.spacing.xl}px;
`;

function documentStatus(document: StudentDocument) {
  if (document.validUntil) return `Válido até ${document.validUntil}`;
  return document.hasExistingDocument
    ? 'Documento emitido'
    : 'Ainda não emitido';
}

export function DocumentsPage() {
  const focused = useIsFocused();
  // Drawer routes stay mounted when another screen opens. Unmount the private
  // document state on blur so pending PDFs cannot open a native modal there.
  return focused ? <DocumentsScreen /> : null;
}

function DocumentsScreen() {
  const {
    query,
    owner,
    operation,
    result,
    error,
    issue,
    remove,
    share,
    clearResult,
    clearError,
  } = useDocuments();
  const online = useOnlineStatus();
  const [deletion, setDeletion] = useState<{
    owner: string;
    document: StudentDocument;
  } | null>(null);
  const selected = deletion?.owner === owner ? deletion.document : null;
  const busy = operation !== null;
  const retry = () => {
    void query.refetch();
  };
  const closeDeletion = () => {
    if (busy) return;
    setDeletion(null);
    clearError();
  };
  const confirmDeletion = () => {
    if (!selected) return;
    void remove(selected).then(deleted => {
      if (deleted) setDeletion(null);
    });
  };

  return (
    <ScreenPanel
      onRefresh={busy ? undefined : retry}
      refreshing={query.isRefetching}
    >
      <Intro variant="body" tone="muted">
        Emita documentos oficiais do Aluno Online e compartilhe o PDF com o app
        de sua escolha.
      </Intro>
      <QueryNotice
        dataUpdatedAt={query.dataUpdatedAt}
        isPaused={query.isPaused}
        isFetching={query.isFetching}
        error={query.error}
        hasData={query.data !== undefined}
        retry={retry}
      />
      {error && !selected && !result ? (
        <StateNotice tone="bad" text={errorMessage(error)} />
      ) : null}
      {query.isPending && !query.isPaused ? (
        <SkeletonList count={4} accessibilityLabel="Carregando documentos…" />
      ) : query.error && !query.data ? (
        <EmptyState
          icon="description"
          tone="bad"
          title="Não foi possível consultar os documentos"
          text={errorMessage(query.error)}
          action={{
            label: 'Tentar novamente',
            icon: 'refresh',
            onPress: retry,
          }}
        />
      ) : query.data?.length === 0 ? (
        <EmptyState
          icon="description"
          title="Nenhum documento disponível"
          text="O Aluno Online não disponibilizou documentos para sua conta."
        />
      ) : query.data ? (
        <Section first title="Documentos disponíveis">
          <List>
            {query.data.map(document => (
              <ListRow
                key={document.id}
                title={document.title}
                leadingIcon="description"
                leadingAlign="start"
                meta={documentStatus(document)}
              >
                {!document.canIssue && !document.canDelete ? (
                  <Text variant="meta" tone="muted">
                    Indisponível para emissão no momento.
                  </Text>
                ) : null}
                <Actions>
                  {document.canIssue ? (
                    <Button
                      label={
                        document.hasExistingDocument
                          ? 'Obter PDF'
                          : 'Emitir PDF'
                      }
                      accessibilityLabel={`${document.hasExistingDocument ? 'Obter PDF' : 'Emitir PDF'}: ${document.title}`}
                      icon="download"
                      variant="outline"
                      loading={
                        operation?.kind === 'issue' &&
                        operation.id === document.id
                      }
                      loadingLabel="Preparando PDF…"
                      disabled={busy || !online}
                      onPress={() => {
                        void issue(document);
                      }}
                    />
                  ) : null}
                  {document.canDelete ? (
                    <Button
                      label="Excluir documento"
                      accessibilityLabel={`Excluir documento: ${document.title}`}
                      variant="text"
                      disabled={busy || !online}
                      onPress={() => {
                        clearError();
                        setDeletion({ owner, document });
                      }}
                    />
                  ) : null}
                </Actions>
              </ListRow>
            ))}
          </List>
        </Section>
      ) : null}
      {query.data && query.data.length > 0 ? (
        <Section title="Precisa atualizar os dados?">
          <Text variant="body" tone="muted">
            O portal entrega uma nova cópia do documento já emitido enquanto ele
            estiver válido. Para gerar um documento com dados atualizados,
            exclua o documento vigente e emita outro. Ao emitir uma nova via, o
            portal exclui automaticamente as vias vencidas do mesmo tipo.
          </Text>
        </Section>
      ) : null}
      <BottomSheet
        visible={result !== null}
        onClose={clearResult}
        title="PDF pronto"
        closeLabel="Fechar documento"
        swipeToClose={!busy}
        footer={
          <Button
            label="Compartilhar PDF"
            icon="share"
            loading={operation?.kind === 'share'}
            loadingLabel="Abrindo…"
            disabled={busy}
            onPress={() => {
              void share();
            }}
          />
        }
      >
        {result ? (
          <SheetBody>
            <Text variant="headline">{result.document.title}</Text>
            <Text variant="body" tone="muted">
              Escolha um app para abrir, enviar ou salvar seu PDF. Se fechar a
              lista de apps, você pode tentar novamente sem emitir outro
              documento.
            </Text>
            {error ? <Notice tone="bad" text={errorMessage(error)} /> : null}
          </SheetBody>
        ) : null}
      </BottomSheet>
      <BottomSheet
        visible={selected !== null}
        onClose={closeDeletion}
        title="Excluir documento?"
        closeLabel="Cancelar exclusão"
        swipeToClose={!busy}
        footer={
          <>
            <Button
              label="Cancelar"
              variant="outline"
              disabled={busy}
              onPress={closeDeletion}
            />
            <Button
              label="Excluir"
              accessibilityLabel="Confirmar exclusão do documento"
              loading={operation?.kind === 'remove'}
              loadingLabel="Excluindo…"
              disabled={busy || !online}
              onPress={confirmDeletion}
            />
          </>
        }
      >
        {selected ? (
          <SheetBody>
            <Text variant="headline">{selected.title}</Text>
            <Notice
              tone="warn"
              text="Esta ação exclui o documento vigente no Aluno Online e não pode ser desfeita. Depois da exclusão, você precisará emitir um novo PDF."
            />
            {error ? <Notice tone="bad" text={errorMessage(error)} /> : null}
          </SheetBody>
        ) : null}
      </BottomSheet>
    </ScreenPanel>
  );
}
