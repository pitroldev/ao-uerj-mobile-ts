import React, { useCallback, useState } from 'react';
import { FlatList, ListRenderItemInfo } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { errorMessage, isTransientError } from '@root/shared/errors/AppError';
import { useBackHandler } from '@hooks/useBackHandler';
import { communityKeys } from '@root/modules/community/presentation/queryKeys';
import { TeacherView } from '@features/TeacherDetails/TeacherView';
import { ScreenPanel } from '@templates/ScreenPanel';
import { useHeaderBack } from '@templates/Header';
import {
  EmptyState,
  ErrorState,
  ListRow,
  ListSeparator,
  SearchField,
  SkeletonList,
} from '@components/ui';
import {
  SearchArea,
  StateArea,
  useListContentStyle,
} from './TeacherSearch.styles';

export const TeacherSearch = () => {
  const [search, setSearch] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const { community } = useAppServices();
  const { account } = useIdentity();
  const clearSelection = useCallback(() => setSelectedTeacher(''), []);
  useBackHandler(clearSelection, Boolean(selectedTeacher));
  useHeaderBack(selectedTeacher ? clearSelection : null);
  const listContentStyle = useListContentStyle();
  const teachers = useQuery({
    queryKey: communityKeys.teachers(account?.scope ?? 'signed-out'),
    queryFn: ({ signal }) => community.teachers({ signal }),
    enabled: Boolean(account),
    staleTime: 24 * 60 * 60 * 1000,
    retry: (count, error) => count < 1 && isTransientError(error),
  });
  const teacher = useQuery({
    queryKey: communityKeys.teacher(
      account?.scope ?? 'signed-out',
      selectedTeacher,
    ),
    queryFn: ({ signal }) => community.teacher(selectedTeacher, { signal }),
    enabled: Boolean(account && selectedTeacher),
    staleTime: 60 * 60 * 1000,
    retry: (count, error) => count < 1 && isTransientError(error),
  });
  const normalizedSearch = search
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  const filteredData = teachers.data?.filter(name =>
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .includes(normalizedSearch),
  );
  if (selectedTeacher)
    return (
      <ScreenPanel>
        {teacher.isLoading && (
          <SkeletonList count={4} accessibilityLabel="Carregando professor…" />
        )}
        {!!teacher.error && (
          <ErrorState
            message={errorMessage(teacher.error)}
            onRetry={() => {
              void teacher.refetch();
            }}
          />
        )}
        {teacher.data && <TeacherView {...teacher.data} />}
        {teacher.data === null && (
          <EmptyState
            icon="person_search"
            text="Nenhum detalhe encontrado para este professor. Volte para escolher outro nome."
            action={{
              label: 'Escolher outro nome',
              icon: 'arrow_back',
              onPress: clearSelection,
            }}
          />
        )}
      </ScreenPanel>
    );
  const renderItem = ({ item }: ListRenderItemInfo<string>) => (
    <ListRow
      title={item}
      chevron
      divider={false}
      onPress={() => setSelectedTeacher(item)}
    />
  );
  return (
    <ScreenPanel scroll={false}>
      <SearchArea>
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Pesquise pelo nome do professor"
        />
      </SearchArea>
      <StateArea>
        {teachers.isLoading && <SkeletonList />}
        {!teachers.isLoading &&
          !teachers.error &&
          filteredData?.length === 0 && (
            <EmptyState icon="search_off" text="Nenhum professor encontrado" />
          )}
        {!!teachers.error && (
          <ErrorState
            message={errorMessage(teachers.error)}
            onRetry={() => {
              void teachers.refetch();
            }}
          />
        )}
      </StateArea>
      <FlatList
        data={filteredData}
        renderItem={renderItem}
        ItemSeparatorComponent={ListSeparator}
        contentContainerStyle={listContentStyle}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyExtractor={item => item}
      />
    </ScreenPanel>
  );
};
