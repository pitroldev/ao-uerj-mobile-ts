import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FlatList, ListRenderItemInfo, StyleSheet } from 'react-native';
import { useFormContext, useWatch } from 'react-hook-form';
import styled from 'styled-components/native';

import {
  useCurriculum,
  useHistory,
  useUniversalSubjects,
} from '@root/modules/academics/presentation/queries';
import {
  completedSubjectIds,
  reconcileCurriculumCompletion,
} from '@root/modules/academics/domain/rules/completion';
import { normalizeSubjectId } from '@root/modules/academics/domain/rules/subjectId';
import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import type { CurriculumSubject } from '@root/modules/academics/domain/models';
import type { SubjectAvailability } from '@root/modules/planning/domain/availability';
import type { GeneratorDraft } from '@root/modules/planning/domain/models';
import { usePlanningCatalog } from '@root/modules/planning/presentation/usePlanningCatalog';
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
  Notice,
  SearchField,
  SelectField,
  SkeletonList,
  Tag,
} from '@components/ui';
import {
  buildDepartmentOptions,
  departmentOf,
} from '@features/UniversalSubjects';

import {
  CountLine,
  FooterStatus,
  GeneratorStep,
  ListHead,
  StepIntro,
  Strong,
  useStepListStyle,
} from '../../layout';
import { BLOCKED_TEXT, isPortalBlocked, plural } from '../../format';
import { ChosenSheet } from './ChosenSheet';
import { SubjectStatus, hasProblem, statusText } from './SubjectStatus';

/** De onde vêm as disciplinas da lista: o curso (por tipo) ou as universais. */
type Source = 'ALL' | 'MANDATORY' | 'RESTRICTED' | 'DEFINED' | 'UNIVERSAL';

const SOURCES: { value: Source; label: string }[] = [
  { value: 'ALL', label: 'Do meu curso' },
  { value: 'MANDATORY', label: 'Obrigatórias' },
  { value: 'RESTRICTED', label: 'Eletivas restritas' },
  { value: 'DEFINED', label: 'Eletivas definidas' },
  { value: 'UNIVERSAL', label: 'Universais' },
];

const ALL_UNITS = '';
const NO_SUBJECTS: CurriculumSubject[] = [];

const Field = styled.View`
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
  /** O que o portal disse dela (só as escolhidas têm). */
  state?: SubjectAvailability;
  last: boolean;
  onToggle: (subject: CurriculumSubject) => void;
};

const SubjectRow = memo(function ({
  subject,
  selected,
  state,
  last,
  onToggle,
}: RowProps) {
  const { id, name, period, branch, type, credits, minimum_credits } = subject;
  // "Turma no Período?" do portal: sem turma, não há o que gerar
  const offered = subject.subjectOfPeriod !== false;
  // uma linha só: de onde ela é e quanto vale (o tipo já está no chip)
  const context = [
    type === 'UNIVERSAL'
      ? (departmentOf(id).unitName ?? SUBJECT_TYPE[type])
      : period
        ? `${period}º período`
        : null,
    branch ? `Ramificação ${branch}` : null,
    type === 'RESTRICTED' || type === 'DEFINED' ? SUBJECT_TYPE[type] : null,
    credits ? `${credits} créditos` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const status = selected ? statusText(state) : '';

  return (
    <ListRow
      title={name}
      code={id}
      meta={context || undefined}
      facts={selected && state ? <SubjectStatus state={state} /> : undefined}
      leading={<Checkbox checked={selected} style={CHECK_OFFSET} />}
      leadingAlign="start"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: !offered }}
      accessibilityLabel={[
        name,
        id,
        context,
        offered ? null : 'Sem turma neste período',
        status,
      ]
        .filter(Boolean)
        .join(', ')}
      disabled={!offered && !selected}
      onPress={() => onToggle(subject)}
      divider={!last}
    >
      {!offered ? (
        <Tag icon="event_busy" label="Sem turma neste período" />
      ) : minimum_credits ? (
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

/** As com turma no período vêm antes; a ordem do portal se mantém em cada grupo. */
function offeredFirst(subjects: CurriculumSubject[]): CurriculumSubject[] {
  return [
    ...subjects.filter(subject => subject.subjectOfPeriod !== false),
    ...subjects.filter(subject => subject.subjectOfPeriod === false),
  ];
}

/**
 * Passo 1: o que o aluno quer cursar. A lista é a do currículo (por tipo) ou,
 * no chip "Universais", a das eletivas universais, lida só então. Cada
 * disciplina marcada já busca as turmas, e a linha diz o que achou.
 */
export const SubjectsStep = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [source, setSource] = useState<Source>('ALL');
  const [unit, setUnit] = useState(ALL_UNITS);
  const [chosenOpen, setChosenOpen] = useState(false);
  const listStyle = useStepListStyle();
  const listRef = useRef<FlatList<CurriculumSubject>>(null);
  // onde a busca fica no cabeçalho da lista
  const searchTop = useRef(0);
  // com o teclado aberto, o título e os chips saem de cena: a busca sobe
  // para o topo e os resultados aparecem logo abaixo dela
  const showSearchOnTop = () => {
    listRef.current?.scrollToOffset({
      offset: Number(listStyle.paddingTop ?? 0) + searchTop.current - 12,
      animated: true,
    });
  };

  const { nextStep } = useStepsContext();
  const { setValue, getValues, control } = useFormContext<GeneratorDraft>();
  const watched = useWatch({ control, name: 'selectedSubjects' });
  const selectedSubjects = watched ?? NO_SUBJECTS;

  const curriculum = useCurriculum();
  const history = useHistory();
  const universalMode = source === 'UNIVERSAL';
  const universal = useUniversalSubjects(universalMode);
  const catalog = usePlanningCatalog(selectedSubjects);

  const completed = useMemo(
    () => completedSubjectIds(history.data ?? [], curriculum.data ?? []),
    [curriculum.data, history.data],
  );
  const pending = useMemo(
    () =>
      reconcileCurriculumCompletion(
        curriculum.data ?? [],
        history.data ?? [],
      ).filter(subject => !subject.alreadyTaken),
    [curriculum.data, history.data],
  );
  // as universais que o aluno ainda pode puxar: fora as cursadas e as que já
  // estão no currículo dele (essas ficam na lista do curso)
  const universals = useMemo(() => {
    const own = new Set(
      (curriculum.data ?? []).map(subject => normalizeSubjectId(subject.id)),
    );
    return (universal.data ?? [])
      .filter(subject => {
        const key = normalizeSubjectId(subject.id);
        return !completed.has(key) && !own.has(key);
      })
      .map((subject): CurriculumSubject => ({
        id: subject.id,
        name: subject.name,
        type: 'UNIVERSAL',
        period: null,
        credits: subject.credits,
        workload: subject.workload,
        minimum_credits: null,
        subjectOfPeriod: subject.subjectOfPeriod,
      }));
  }, [completed, curriculum.data, universal.data]);
  const unitOptions = useMemo(
    () => [
      { value: ALL_UNITS, label: 'Todos os departamentos' },
      ...buildDepartmentOptions(universal.data ?? []),
    ],
    [universal.data],
  );

  // uma disciplina concluída desde a escolha sai dela
  useEffect(() => {
    const selected = getValues('selectedSubjects') ?? [];
    const stillPending = selected.filter(
      subject => !completed.has(normalizeSubjectId(subject.id)),
    );
    if (stillPending.length !== selected.length)
      setValue('selectedSubjects', stillPending);
  }, [completed, getValues, setValue]);

  const toggle = useCallback(
    (subject: CurriculumSubject) => {
      const current = getValues('selectedSubjects') ?? [];
      setValue(
        'selectedSubjects',
        current.some(item => item.id === subject.id)
          ? current.filter(item => item.id !== subject.id)
          : [...current, subject],
      );
    },
    [getValues, setValue],
  );

  const selectedIds = useMemo(
    () => new Set(selectedSubjects.map(subject => subject.id)),
    [selectedSubjects],
  );

  const query = universalMode ? universal : curriculum;
  const loading = query.isLoading;
  const error = query.error;
  const base = universalMode ? universals : pending;
  const failed = !loading && Boolean(error) && !query.data;
  const showList = !loading && !failed;

  const search = normalizeText(searchQuery);
  const visible = offeredFirst(
    base.filter(({ type, name, id }) => {
      if (!universalMode && source !== 'ALL' && type !== source) return false;
      if (universalMode && unit && departmentOf(id).value !== unit)
        return false;
      return (
        !search ||
        normalizeText(name).includes(search) ||
        normalizeText(id).includes(search)
      );
    }),
  );
  // os tipos viram chip só quando o currículo do aluno tem mais de um
  const types = new Set(pending.map(subject => subject.type));
  const sources = SOURCES.filter(
    option =>
      option.value === 'ALL' ||
      option.value === 'UNIVERSAL' ||
      (types.size > 1 && types.has(option.value)),
  );

  const credits = selectedSubjects.reduce(
    (sum, subject) => sum + (subject.credits ?? 0),
    0,
  );
  const problems = selectedSubjects.filter(subject =>
    hasProblem(catalog.availability.get(subject.id)),
  ).length;
  const chosenText = selectedSubjects.length
    ? [
        plural(selectedSubjects.length, 'escolhida', 'escolhidas'),
        credits ? plural(credits, 'crédito', 'créditos') : null,
        problems
          ? plural(problems, 'não pode entrar', 'não podem entrar')
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Nenhuma disciplina escolhida';

  const retry = () => {
    void query.refetch();
  };
  const clearFilters = () => {
    setSearchQuery('');
    setUnit(ALL_UNITS);
  };
  // a busca é da lista em que foi feita: outra origem começa sem filtro
  const changeSource = (next: Source) => {
    if (next === source) return;
    clearFilters();
    setSource(next);
  };

  const renderSubject = ({
    item,
    index,
  }: ListRenderItemInfo<CurriculumSubject>) => (
    <SubjectRow
      subject={item}
      selected={selectedIds.has(item.id)}
      state={catalog.availability.get(item.id)}
      last={index === visible.length - 1}
      onToggle={toggle}
    />
  );

  const header = (
    <ListHead>
      <QueryNotice
        dataUpdatedAt={curriculum.dataUpdatedAt}
        isPaused={curriculum.isPaused}
        isFetching={curriculum.isFetching}
        error={curriculum.error}
        hasData={curriculum.data !== undefined}
        retry={curriculum.refetch}
      />
      {history.error ? (
        <Notice
          tone="warn"
          text="Não deu para ler o seu histórico."
          onRetry={() => {
            void history.refetch();
          }}
        />
      ) : null}
      <StepIntro title="O que você quer cursar?" />

      <ChipGroup
        layout="scroll"
        accessibilityLabel="De onde é a disciplina"
        style={styles.chips}
      >
        {sources.map(option => (
          <FilterChip
            key={option.value}
            label={option.label}
            selected={source === option.value}
            onPress={() => changeSource(option.value)}
          />
        ))}
      </ChipGroup>

      {universalMode && showList ? (
        <Field>
          <SelectField
            label="Departamento"
            icon="apartment"
            sheetTitle="Departamento"
            options={unitOptions}
            value={unit}
            onChange={setUnit}
          />
        </Field>
      ) : null}

      <Field
        onLayout={event => {
          searchTop.current = event.nativeEvent.layout.y;
        }}
      >
        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={showSearchOnTop}
          placeholder="Pesquise pelo nome ou código"
          accessibilityLabel="Pesquisar disciplina"
        />
      </Field>

      {showList ? (
        <CountLine
          left={
            <>
              <Strong>{visible.length}</Strong>{' '}
              {universalMode
                ? visible.length === 1
                  ? 'eletiva universal'
                  : 'eletivas universais'
                : visible.length === 1
                  ? 'disciplina'
                  : 'disciplinas'}
            </>
          }
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
            onPress: retry,
          }}
        />
      ) : failed ? (
        <ErrorState
          message="Não deu para buscar as disciplinas. Toque para tentar de novo."
          onRetry={retry}
        />
      ) : null}
      {showList && !query.isPaused && visible.length === 0 ? (
        <EmptyState
          icon="search_off"
          text={
            search || unit
              ? 'Nada com essa busca.'
              : universalMode
                ? 'Nenhuma eletiva universal agora.'
                : 'Nada a cursar aqui.'
          }
          action={
            search || unit
              ? {
                  label: 'Limpar filtros',
                  icon: 'filter_alt_off',
                  onPress: clearFilters,
                }
              : undefined
          }
        />
      ) : null}
    </ListHead>
  );

  return (
    <GeneratorStep
      scroll={false}
      footerYieldsToKeyboard
      footer={{
        status: (
          <FooterStatus
            text={chosenText}
            tone={problems ? 'bad' : 'muted'}
            icon={problems ? 'error' : undefined}
            onPress={
              selectedSubjects.length ? () => setChosenOpen(true) : undefined
            }
            actionLabel="Ver as disciplinas escolhidas"
          />
        ),
        next: {
          label: 'Próximo',
          icon: 'arrow_forward',
          iconPosition: 'end',
          onPress: nextStep,
          disabled: selectedSubjects.length === 0,
        },
      }}
    >
      <FlatList
        ref={listRef}
        data={showList ? visible : NO_SUBJECTS}
        renderItem={renderSubject}
        extraData={catalog.availability}
        keyExtractor={item => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={listStyle}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
      />
      <ChosenSheet
        visible={chosenOpen}
        onClose={() => setChosenOpen(false)}
        subjects={selectedSubjects}
        availability={catalog.availability}
        failed={catalog.failed}
        onRetry={catalog.retry}
        onRemove={toggle}
      />
    </GeneratorStep>
  );
};

const styles = StyleSheet.create({
  chips: { marginTop: 12 },
});
