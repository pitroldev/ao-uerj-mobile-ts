import { MAX_CLASSES_AMOUNT } from '@root/modules/planning/domain/rules';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { useFormContext, useWatch } from 'react-hook-form';
import styled from 'styled-components/native';

import { useStepsContext } from '@hooks/useSteps';
import { normalizeSubjectId } from '@root/modules/academics/domain/rules/subjectId';
import {
  Checkbox,
  EmptyState,
  ListRow,
  Notice,
  SelectField,
  StatusLabel,
} from '@components/ui';

import {
  ScheduleCreationParams,
  SubjectClasses,
} from '@root/modules/planning/domain/models';
import { SubjectInfo } from '@root/modules/academics/domain/models';

import {
  CountLine,
  GeneratorStep,
  ListHead,
  StepIntro,
  Strong,
  useStepListStyle,
} from '../../layout';
import { classMeetings } from '../../format';

const ALL_TEACHERS = '';

const Teacher = styled.View`
  margin-top: 16px;
`;

const LimitNotice = styled(Notice)`
  margin-top: 16px;
`;

/** ".sel-row .cb": a caixa desce 20 para alinhar com a linha do código. */
const CHECK_OFFSET = StyleSheet.create({ box: { marginTop: 20 } }).box;

const sameClass = (a: SubjectClasses, b: SubjectClasses) =>
  a.classNumber === b.classNumber && a.subject_id === b.subject_id;

type RowProps = {
  item: SubjectClasses;
  subject?: SubjectInfo;
  selected: boolean;
  last: boolean;
  onToggle: (item: SubjectClasses) => void;
};

const ClassRow = memo(function ({
  item,
  subject,
  selected,
  last,
  onToggle,
}: RowProps) {
  const teachers = (item.teachers ?? []).join(', ');
  const meetings = classMeetings(item.schedule);
  return (
    <ListRow
      title={subject?.name ?? item.subject_id}
      code={subject?.id ?? item.subject_id}
      subtitle={`Turma ${item.classNumber}`}
      meta={[teachers, meetings].filter(Boolean)}
      facts={
        item.hasPreference ? (
          <StatusLabel tone="info" icon="star" label="Preferencial" />
        ) : undefined
      }
      leading={<Checkbox checked={selected} style={CHECK_OFFSET} />}
      leadingAlign="start"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={() => onToggle(item)}
      divider={!last}
    />
  );
});
ClassRow.displayName = 'ClassRow';

export const ClassesStep = () => {
  const [teacher, setTeacher] = useState(ALL_TEACHERS);
  const listStyle = useStepListStyle();

  const { nextStep, prevStep } = useStepsContext();

  const { handleSubmit, setValue, getValues, control } =
    useFormContext<ScheduleCreationParams>();

  const { subjects = [], selectedClasses = [] } = useWatch({ control });

  const classes = subjects.reduce((acc, s) => {
    if (!s.classes) {
      return acc;
    }

    const classesToAdd = s.classes.map(c => ({
      ...c,
      subject_id: s.id,
    })) as SubjectClasses[];
    acc.push(...classesToAdd);

    return acc;
  }, [] as SubjectClasses[]);

  const handleNextPress = handleSubmit(nextStep);

  const filteredClasses = classes.filter(
    c => c.teachers?.includes(teacher) || teacher === ALL_TEACHERS,
  );

  const teachers = classes
    .reduce((acc, c) => {
      if (c.teachers) {
        c.teachers.forEach(t => {
          if (!acc.includes(t)) {
            acc.push(t);
          }
        });
      }
      return acc;
    }, [] as string[])
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const isOverMaxClasses = selectedClasses.length > MAX_CLASSES_AMOUNT;
  const removeNumber = selectedClasses.length - MAX_CLASSES_AMOUNT;

  const handleClassPress = useCallback(
    (c: SubjectClasses) => {
      const current = getValues('selectedClasses') ?? [];
      const isSelected = current.some(sc => sameClass(sc, c));

      if (isSelected) {
        setValue(
          'selectedClasses',
          current.filter(sc => !sameClass(sc, c)),
        );
        return;
      }

      setValue('selectedClasses', [...current, c]);
    },
    [getValues, setValue],
  );

  const selectedKeys = useMemo(
    () =>
      new Set(selectedClasses.map(c => `${c?.subject_id}#${c?.classNumber}`)),
    [selectedClasses],
  );

  const subjectOf = (item: SubjectClasses) =>
    subjects.find(
      s =>
        normalizeSubjectId(s.id as string) ===
        normalizeSubjectId(item.subject_id),
    ) as SubjectInfo | undefined;

  const header = (
    <ListHead>
      <StepIntro
        title="Deseja remover alguma outra turma?"
        description="Desmarque as turmas que não devem entrar na grade."
      />
      {isOverMaxClasses ? (
        <LimitNotice
          tone="bad"
          icon="error"
          text={`Você selecionou mais de ${MAX_CLASSES_AMOUNT} turmas. Por favor, remova ${removeNumber} turmas.`}
        />
      ) : null}
      <Teacher>
        <SelectField
          label="Docente"
          icon="person"
          sheetTitle="Docente"
          options={[
            { value: ALL_TEACHERS, label: 'Todos os Professores' },
            ...teachers.map(t => ({ value: t, label: t })),
          ]}
          value={teacher}
          onChange={setTeacher}
        />
      </Teacher>
      <CountLine
        left={
          <>
            <Strong>{selectedClasses.length}</Strong> de {classes.length} turmas
            selecionadas
          </>
        }
        right={`Máximo de ${MAX_CLASSES_AMOUNT}`}
      />
    </ListHead>
  );

  return (
    <GeneratorStep
      scroll={false}
      footer={{
        onPrev: prevStep,
        next: {
          label: 'Próximo',
          icon: 'arrow_forward',
          iconPosition: 'end',
          onPress: handleNextPress,
          disabled: isOverMaxClasses || !selectedClasses.length,
        },
      }}
    >
      <FlatList
        data={filteredClasses}
        renderItem={({ item, index }) => (
          <ClassRow
            item={item}
            subject={subjectOf(item)}
            selected={selectedKeys.has(
              `${item.subject_id}#${item.classNumber}`,
            )}
            last={index === filteredClasses.length - 1}
            onToggle={handleClassPress}
          />
        )}
        extraData={selectedKeys}
        keyExtractor={(item, index) =>
          `${item.subject_id}-${item.classNumber}-${index}`
        }
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            icon="event_busy"
            text="Nenhuma turma encontrada para as disciplinas selecionadas."
          />
        }
        contentContainerStyle={listStyle}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
      />
    </GeneratorStep>
  );
};
