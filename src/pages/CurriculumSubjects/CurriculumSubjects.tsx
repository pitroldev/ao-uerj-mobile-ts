import React, { useCallback, useRef, useState } from 'react';
import type { FlatList, ListRenderItemInfo } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import styled from 'styled-components/native';

import {
  useCurriculum,
  isPortalBlocked,
} from '@root/modules/academics/presentation/queries';
import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import type { CurriculumSubject } from '@root/modules/academics/domain/models';

import {
  ChipGroup,
  FilterChip,
  SearchField,
  SegmentedControl,
} from '@components/ui';
import {
  CURRICULUM_TYPE_FILTERS,
  CurriculumSubjectRow,
} from '@features/CurriculumSubjects';
import {
  SUBJECT_LIST_COPY,
  ShowingCount,
  SubjectListFallback,
  SubjectListPanel,
  matchesSubjectSearch,
  showsCount,
  subjectListPhase,
} from '@features/SubjectsToTake';

type TypeFilter = (typeof CURRICULUM_TYPE_FILTERS)[number]['value'];
type TakenFilter = 'pending' | 'taken';

const TAKEN_OPTIONS = [
  { value: 'pending' as const, label: 'Não atendidas' },
  { value: 'taken' as const, label: 'Atendidas' },
];

const NO_SUBJECTS: CurriculumSubject[] = [];

/** 10 entre os filtros (".segm"/".field" margin-top 10). */
const Spaced = styled.View`
  margin-top: 10px;
`;

const CurriculumSubjects = () => {
  const [taken, setTaken] = useState<TakenFilter>('pending');
  const [subjectType, setSubjectType] = useState<TypeFilter>('');
  const [searchQuery, setSearchQuery] = useState('');

  const query = useCurriculum();
  const { error, refetch } = query;
  const data = query.data ?? NO_SUBJECTS;

  const navigation = useNavigation();
  const listRef = useRef<FlatList<CurriculumSubject>>(null);

  const scrollToTop = () =>
    listRef.current?.scrollToOffset({ animated: true, offset: 0 });

  const handleSubjectTypeChange = (value: TypeFilter) => {
    setSubjectType(value);
    scrollToTop();
  };

  const handleTakenChange = (value: TakenFilter) => {
    setTaken(value);
    scrollToTop();
  };

  const handleSubjectPress = useCallback(
    (subject: CurriculumSubject) => {
      navigation.navigate('Pesquisa de Disciplinas', {
        subjectId: subject.id,
        sourceRoute: 'Disciplinas do Currículo',
      });
    },
    [navigation],
  );

  const renderSubject = useCallback(
    ({ item }: ListRenderItemInfo<CurriculumSubject>) =>
      item ? (
        <CurriculumSubjectRow subject={item} onPress={handleSubjectPress} />
      ) : null,
    [handleSubjectPress],
  );

  const filteredData = data.filter(subject => {
    const hasSubjectType = !subjectType || subject.type === subjectType;
    const hasSubjectAlreadyTaken =
      (taken === 'taken') === Boolean(subject.alreadyTaken);
    return (
      hasSubjectType &&
      hasSubjectAlreadyTaken &&
      matchesSubjectSearch(searchQuery, subject)
    );
  });

  const phase = subjectListPhase(query, {
    hasData: query.data !== undefined,
    blocked: isPortalBlocked(error),
  });

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
      <ChipGroup layout="scroll" accessibilityLabel="Tipo de disciplina">
        {CURRICULUM_TYPE_FILTERS.map(({ value, label }) => (
          <FilterChip
            key={value || 'all'}
            label={label}
            selected={subjectType === value}
            onPress={() => handleSubjectTypeChange(value)}
          />
        ))}
      </ChipGroup>
      <Spaced>
        <SegmentedControl
          options={TAKEN_OPTIONS}
          value={taken}
          onChange={handleTakenChange}
          accessibilityLabel="Situação"
        />
      </Spaced>
      <Spaced>
        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={SUBJECT_LIST_COPY.searchPlaceholder}
        />
      </Spaced>
      {showsCount(phase) ? <ShowingCount count={filteredData.length} /> : null}
    </>
  );

  return (
    <SubjectListPanel
      listRef={listRef}
      header={header}
      items={filteredData}
      renderItem={renderSubject}
      keyExtractor={(item, index) => `${item.id}-${index}`}
      fallback={
        <SubjectListFallback
          phase={phase}
          onRetry={refetch}
          empty={{ icon: 'search_off', text: SUBJECT_LIST_COPY.filterEmpty }}
        />
      }
    />
  );
};

export default CurriculumSubjects;
