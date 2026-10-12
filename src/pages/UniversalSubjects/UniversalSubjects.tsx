import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { FlatList, ListRenderItemInfo } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import styled from 'styled-components/native';

import {
  useUniversalSubjects,
  isPortalBlocked,
} from '@root/modules/academics/presentation/queries';
import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import type { UniversalSubject } from '@root/modules/academics/domain/models';

import { SearchField, SelectField } from '@components/ui';
import {
  UniversalSubjectRow,
  buildDepartmentOptions,
} from '@features/UniversalSubjects';
import {
  SUBJECT_LIST_COPY,
  ShowingCount,
  SubjectListFallback,
  SubjectListPanel,
  matchesSubjectSearch,
  showsCount,
  subjectListPhase,
} from '@features/SubjectsToTake';

const ALL_DEPARTMENTS = '';
const NO_SUBJECTS: UniversalSubject[] = [];

/** 10 entre o seletor e a busca (".field" margin-top 10). */
const Spaced = styled.View`
  margin-top: 10px;
`;

const UniversalSubjects = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState(ALL_DEPARTMENTS);

  const query = useUniversalSubjects();
  const { error, refetch } = query;
  const subjects = query.data ?? NO_SUBJECTS;

  const departmentOptions = useMemo(
    () => [
      { value: ALL_DEPARTMENTS, label: 'Todos os departamentos' },
      ...buildDepartmentOptions(subjects),
    ],
    [subjects],
  );

  const navigation = useNavigation();
  const listRef = useRef<FlatList<UniversalSubject>>(null);

  const handleDepartmentChange = (value: string) => {
    setSelectedDepartment(value);
    listRef.current?.scrollToOffset({ animated: true, offset: 0 });
  };

  const clearFilters = () => {
    setSelectedDepartment(ALL_DEPARTMENTS);
    setSearchQuery('');
  };

  const handleSubjectPress = useCallback(
    (subject: UniversalSubject) => {
      navigation.navigate('Pesquisa de Disciplinas', {
        subjectId: subject.id,
        sourceRoute: 'Disciplinas Universais',
      });
    },
    [navigation],
  );

  const renderSubject = useCallback(
    ({ item }: ListRenderItemInfo<UniversalSubject>) =>
      item ? (
        <UniversalSubjectRow subject={item} onPress={handleSubjectPress} />
      ) : null,
    [handleSubjectPress],
  );

  const filteredSubjects = subjects.filter(
    subject =>
      (!selectedDepartment || subject.id.includes(selectedDepartment)) &&
      matchesSubjectSearch(searchQuery, subject),
  );

  const phase = subjectListPhase(query, {
    hasData: query.data !== undefined,
    blocked: isPortalBlocked(error),
  });
  const hasFilters = Boolean(selectedDepartment || searchQuery);

  const header = (
    <>
      <QueryNotice
        dataUpdatedAt={query.dataUpdatedAt}
        isPaused={query.isPaused}
        isFetching={query.isFetching}
        error={error}
        hasData={query.data !== undefined}
        retry={refetch}
      />
      <SelectField
        label="Departamento"
        icon="apartment"
        options={departmentOptions}
        value={selectedDepartment}
        onChange={handleDepartmentChange}
        disabled={subjects.length === 0}
      />
      <Spaced>
        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={SUBJECT_LIST_COPY.searchPlaceholder}
        />
      </Spaced>
      {showsCount(phase) ? (
        <ShowingCount count={filteredSubjects.length} />
      ) : null}
    </>
  );

  return (
    <SubjectListPanel
      listRef={listRef}
      header={header}
      items={filteredSubjects}
      renderItem={renderSubject}
      keyExtractor={(item, index) => `${item.id}-${index}`}
      fallback={
        <SubjectListFallback
          phase={phase}
          onRetry={refetch}
          empty={{
            icon: 'search_off',
            text: SUBJECT_LIST_COPY.filterEmpty,
            action: hasFilters
              ? {
                  label: 'Limpar filtros',
                  icon: 'filter_alt_off',
                  onPress: clearFilters,
                }
              : undefined,
          }}
        />
      }
    />
  );
};

export default UniversalSubjects;
