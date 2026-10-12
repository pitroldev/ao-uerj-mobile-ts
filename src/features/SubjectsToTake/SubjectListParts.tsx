import React, { useMemo } from 'react';
import { FlatList, type FlatListProps } from 'react-native';
import styled from 'styled-components/native';

import {
  EmptyState,
  ErrorState,
  ListSeparator,
  SkeletonList,
  Text,
  type EmptyStateProps,
} from '@components/ui';
import ScreenPanel, { usePanelContentStyle } from '@templates/ScreenPanel';

import {
  SUBJECT_LIST_COPY,
  plural,
  type SubjectListPhase,
} from './subjectList';

/* ------------------------------------------------------------------ contagem */

/** Linha de contagem (".count"): 16 acima, 4 abaixo, 13/18 secundário. */
export const CountRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
  column-gap: ${({ theme }) => theme.spacing.md}px;
  margin-top: ${({ theme }) => theme.spacing.lg}px;
  margin-bottom: ${({ theme }) => theme.spacing.xs}px;
`;

/** "Exibindo 15 disciplinas" (Currículo e Universais). */
export function ShowingCount({ count }: { count: number }) {
  const text = `Exibindo ${plural(count, 'disciplina', 'disciplinas')}`;
  return (
    <CountRow>
      <Text variant="meta" tone="muted" accessibilityLiveRegion="polite">
        {text}
      </Text>
    </CountRow>
  );
}

/* -------------------------------------------------------- estados sem lista */

export type SubjectListFallbackProps = {
  phase: SubjectListPhase;
  onRetry: () => void;
  /** Estado vazio da tela (a busca terminou sem itens ou o filtro não achou nada). */
  empty: EmptyStateProps;
};

/**
 * O que ocupa o lugar da lista quando ela está vazia: esqueleto, portal
 * bloqueado, erro com nova tentativa ou o estado vazio da tela. Sem conexão
 * e sem dados, o `QueryNotice` no topo já explica, então nada aparece aqui.
 */
export function SubjectListFallback({
  phase,
  onRetry,
  empty,
}: SubjectListFallbackProps) {
  switch (phase) {
    case 'loading':
      return (
        <SkeletonList
          count={5}
          accessibilityLabel={SUBJECT_LIST_COPY.loading}
        />
      );
    case 'blocked':
      return (
        <EmptyState
          icon="lock"
          tone="bad"
          text={SUBJECT_LIST_COPY.blocked}
          action={{
            label: 'Tentar novamente',
            icon: 'refresh',
            onPress: onRetry,
          }}
        />
      );
    case 'error':
      return (
        <ErrorState message={SUBJECT_LIST_COPY.listError} onRetry={onRetry} />
      );
    case 'offline':
      return null;
    default:
      return <EmptyState {...empty} />;
  }
}

/* ------------------------------------------------------- painel com FlatList */

const Gutter = styled.View`
  padding: 0px ${({ theme }) => theme.layout.gutter}px;
`;

export type SubjectListPanelProps<T> = {
  /** Avisos, filtros, busca e contagem (rolam junto com a lista). */
  header: React.ReactNode;
  items: readonly T[];
  renderItem: FlatListProps<T>['renderItem'];
  keyExtractor: (item: T, index: number) => string;
  /** Ocupa o lugar da lista vazia (`SubjectListFallback`). */
  fallback?: React.ReactNode;
  listRef?: React.Ref<FlatList<T>>;
};

/**
 * Painel das listas longas (Currículo, Universais): `ScreenPanel` fixo com
 * uma `FlatList` cujas linhas sangram até as bordas, separadas por fios que
 * começam em 20. Cabeçalho e estado vazio voltam a ter a margem lateral.
 */
export function SubjectListPanel<T>({
  header,
  items,
  renderItem,
  keyExtractor,
  fallback,
  listRef,
}: SubjectListPanelProps<T>) {
  const panel = usePanelContentStyle();
  const contentStyle = useMemo(
    () => ({
      paddingTop: panel.paddingTop,
      paddingBottom: panel.paddingBottom,
    }),
    [panel.paddingTop, panel.paddingBottom],
  );
  return (
    <ScreenPanel scroll={false}>
      <FlatList
        ref={listRef}
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={ListSeparator}
        ListHeaderComponent={<Gutter>{header}</Gutter>}
        ListEmptyComponent={fallback ? <Gutter>{fallback}</Gutter> : null}
        contentContainerStyle={contentStyle}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
      />
    </ScreenPanel>
  );
}
