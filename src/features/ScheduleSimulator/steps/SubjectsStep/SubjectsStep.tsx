import { useCurriculum } from '@root/modules/academics/presentation/queries';
import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, ListRenderItemInfo, StyleSheet } from 'react-native';
import { useFormContext, useWatch } from 'react-hook-form';
import styled from 'styled-components/native';

import { useStepsContext } from '@hooks/useSteps';
import { normalizeText } from '@utils/normalize';
import { SUBJECT_TYPE } from '@utils/constants/subjectDictionary';
import {
  ChipGroup,
  Checkbox,
  EmptyState,
  ErrorState,
  FilterChip,
  ListRow,
  SearchField,
  SkeletonList,
  Tag,
} from '@components/ui';

import { CurriculumSubject } from '@root/modules/academics/domain/models';

import { ScheduleCreationParams } from '@root/modules/planning/domain/models';

import {
  CountLine,
  GeneratorStep,
  ListHead,
  StepIntro,
  Strong,
  useStepListStyle,
} from '../../layout';
import { BLOCKED_TEXT, isPortalBlocked, plural } from '../../format';

type TypeFilter = '' | 'MANDATORY' | 'RESTRICTED' | 'DEFINED';

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'MANDATORY', label: 'Obrigatórias' },
  { value: 'RESTRICTED', label: 'Eletivas Restritas' },
  { value: 'DEFINED', label: 'Eletivas Definidas' },
];

const Search = styled.View`
  margin-top: 10px;
`;

const Feedback = styled.View`
  margin-top: 8px;
`;

/** ".sel-row .cb": a caixa desce 20 para alinhar com a linha do código. */
const CHECK_OFFSET = StyleSheet.create({ box: { marginTop: 20 } }).box;

type RowProps = {
  subject: CurriculumSubject;
  selected: boolean;
  last: boolean;
  onToggle: (subject: CurriculumSubject) => void;
};

const SubjectRow = memo(function ({
  subject,
  selected,
  last,
  onToggle,
}: RowProps) {
  const { id, name, period, branch, type, credits, workload, minimum_credits } =
    subject;
  const load = [
    credits ? `${credits} créditos` : null,
    workload ? `${workload} horas` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const context = [
    period ? `${period}º período` : null,
    branch ? `Ramificação ${branch}` : null,
    SUBJECT_TYPE[type],
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <ListRow
      title={name}
      code={id}
      subtitle={load || undefined}
      meta={context || undefined}
      leading={<Checkbox checked={selected} style={CHECK_OFFSET} />}
      leadingAlign="start"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={() => onToggle(subject)}
      divider={!last}
    >
      {minimum_credits ? (
        <Tag
          tone="warn"
          icon="lock"
          label={`Trava de ${minimum_credits} créditos`}
        />
      ) : null}
    </ListRow>
  );
});
SubjectRow.displayName = 'SubjectRow';

const SubjectsStep = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectType, setSubjectType] = useState<TypeFilter>('');
  const listStyle = useStepListStyle();

  const { nextStep, prevStep } = useStepsContext();

  const query = useCurriculum();
  const { data = [], error, refetch, isLoading: loading } = query;

  const { handleSubmit, setValue, getValues, control } =
    useFormContext<ScheduleCreationParams>();

  const { min_subject_amount = 1, selectedSubjects = [] } = useWatch({
    control,
  });
  const minimum = min_subject_amount ?? 1;

  const handleNextPress = handleSubmit(nextStep);

  const handleSubjectPress = useCallback(
    (subject: CurriculumSubject) => {
      const current = getValues('selectedSubjects') ?? [];
      const isSelected = current.some(s => s.id === subject.id);

      if (isSelected) {
        setValue(
          'selectedSubjects',
          current.filter(s => s.id !== subject.id),
        );
        return;
      }

      setValue('selectedSubjects', [...current, subject]);
    },
    [getValues, setValue],
  );

  const selectedIds = useMemo(
    () => new Set(selectedSubjects.map(s => s?.id)),
    [selectedSubjects],
  );

  const filteredData = data.filter(({ type, name, id, alreadyTaken }) => {
    if (alreadyTaken) {
      return false;
    }

    const hasSubjectType = !subjectType || type === subjectType;
    const search = normalizeText(searchQuery);
    const hasSearchQuery =
      !searchQuery ||
      normalizeText(name).includes(search) ||
      normalizeText(id).includes(search);

    return hasSubjectType && hasSearchQuery;
  });

  const isEmpty = filteredData.length === 0;
  const failed = !loading && Boolean(error) && !data.length;
  const showList = !loading && !failed;

  const isMinSubjectsAmountValid = selectedSubjects.length >= minimum;

  const renderSubjects = ({
    item,
    index,
  }: ListRenderItemInfo<CurriculumSubject>) => (
    <SubjectRow
      subject={item}
      selected={selectedIds.has(item.id)}
      last={index === filteredData.length - 1}
      onToggle={handleSubjectPress}
    />
  );

  const header = (
    <ListHead>
      <QueryNotice
        dataUpdatedAt={query.dataUpdatedAt}
        isPaused={query.isPaused}
        isFetching={query.isFetching}
        error={error}
        hasData={query.data !== undefined}
        retry={refetch}
      />
      <StepIntro title={`Escolha ${minimum} ou mais disciplinas`} />

      <ChipGroup
        layout="scroll"
        accessibilityLabel="Tipo de disciplina"
        style={styles.chips}
      >
        {TYPE_FILTERS.map(filter => (
          <FilterChip
            key={filter.value || 'ALL'}
            label={filter.label}
            selected={subjectType === filter.value}
            disabled={loading}
            onPress={() => setSubjectType(filter.value)}
          />
        ))}
      </ChipGroup>

      <Search>
        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Pesquise pelo nome da disciplina"
          accessibilityLabel="Pesquisar disciplina"
        />
      </Search>

      {showList ? (
        <CountLine
          left={
            <>
              <Strong>{selectedSubjects.length}</Strong>{' '}
              {selectedSubjects.length === 1 ? 'selecionada' : 'selecionadas'} ·
              mínimo {minimum}
            </>
          }
          right={`Exibindo ${plural(
            filteredData.length,
            'disciplina',
            'disciplinas',
          )}`}
        />
      ) : null}

      {loading ? (
        <Feedback>
          <SkeletonList
            count={6}
            accessibilityLabel="Carregando disciplinas…"
          />
        </Feedback>
      ) : null}
      {failed && isPortalBlocked(error) ? (
        <EmptyState
          icon="lock"
          tone="bad"
          text={BLOCKED_TEXT}
          action={{
            label: 'Tentar novamente',
            icon: 'refresh',
            onPress: refetch,
          }}
        />
      ) : failed ? (
        <ErrorState
          message="Ops, ocorreu um erro ao buscar as disciplinas. Toque aqui para tentar novamente."
          onRetry={refetch}
        />
      ) : null}
      {showList && !query.isPaused && isEmpty ? (
        <EmptyState
          icon="search_off"
          text="Parece que não há disciplinas a cursar nessa categoria."
        />
      ) : null}
    </ListHead>
  );

  return (
    <GeneratorStep
      scroll={false}
      footer={{
        onPrev: prevStep,
        prevDisabled: loading,
        next: {
          label: 'Próximo',
          icon: 'arrow_forward',
          iconPosition: 'end',
          onPress: handleNextPress,
          disabled: !isMinSubjectsAmountValid || loading,
        },
      }}
    >
      <FlatList
        data={showList ? filteredData : []}
        renderItem={renderSubjects}
        extraData={selectedIds}
        keyExtractor={(item, i) => i + item.id}
        ListHeaderComponent={header}
        contentContainerStyle={listStyle}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
      />
    </GeneratorStep>
  );
};

const styles = StyleSheet.create({
  chips: { marginTop: 12 },
});

export default SubjectsStep;
