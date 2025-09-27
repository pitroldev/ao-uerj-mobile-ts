import React, { useState } from 'react';
import { Picker } from '@react-native-picker/picker';
import { useFormContext, useWatch } from 'react-hook-form';
import { FlatList } from 'react-native-gesture-handler';

import { useStepsContext } from '@hooks/useSteps';
import { parseSubjectCode } from '@services/parser/minorParser';

import {
  ScheduleCreationParams,
  SubjectClasses,
} from '@features/ScheduleSimulator/types';
import { SubjectInfo } from '@features/SubjectInfo/types';

import Text from '@atoms/Text';
import Button from '@atoms/Button';
import StyledPicker from '@atoms/Picker';

import SmallClassBox from './SmallClassBox';

import {
  Container,
  ContentContainer,
  ButtonsRow,
  StyledFlatList,
} from './ClassesStep.styles';

const MAX_CLASSES_AMOUNT = 30;

const ClassesStep = () => {
  const [teacher, setTeacher] = useState('');

  const { nextStep, prevStep } = useStepsContext();

  const { handleSubmit, setValue, control } =
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
    c => c.teachers?.includes(teacher) || teacher === '',
  );

  const teachers = classes.reduce((acc, c) => {
    if (c.teachers) {
      c.teachers.forEach(t => {
        if (!acc.includes(t)) {
          acc.push(t);
        }
      });
    }
    return acc;
  }, [] as string[]);

  const isOverMaxClasses = selectedClasses.length > MAX_CLASSES_AMOUNT;
  const removeNumber = selectedClasses.length - MAX_CLASSES_AMOUNT;

  const handleClassPress = (c: SubjectClasses) => {
    const isSelected = selectedClasses.some(
      sc => sc.classNumber === c.classNumber && sc.subject_id === c.subject_id,
    );

    if (isSelected) {
      const newSelectedClasses = selectedClasses.filter(
        sc =>
          sc.classNumber !== c.classNumber || sc.subject_id !== c.subject_id,
      );

      setValue('selectedClasses', newSelectedClasses as SubjectClasses[]);
      return;
    }

    setValue('selectedClasses', [...selectedClasses, c] as SubjectClasses[]);
  };

  const renderClass = ({ item }: { item: SubjectClasses }) => {
    const subject = subjects.find(
      s =>
        parseSubjectCode(s.id as string) === parseSubjectCode(item.subject_id),
    );

    const isSelected = selectedClasses.some(
      c =>
        c.classNumber === item.classNumber && c.subject_id === item.subject_id,
    );

    return (
      <SmallClassBox
        {...item}
        selected={isSelected}
        onPress={handleClassPress}
        subject={subject as SubjectInfo}
      />
    );
  };

  return (
    <Container>
      <ContentContainer>
        <Text weight="bold" size="LG" alignSelf="center" marginBottom="8px">
          Deseja remover alguma outra turma?
        </Text>
        {isOverMaxClasses && (
          <Text
            weight="bold"
            size="SM"
            alignSelf="center"
            marginBottom="8px"
            color="ERROR"
          >
            Você selecionou mais de {MAX_CLASSES_AMOUNT} turmas. Por favor,
            remova {removeNumber} turmas.
          </Text>
        )}

        <StyledPicker
          selectedValue={teacher}
          onValueChange={s => setTeacher(s as string)}
        >
          <Picker.Item label={'Todos os Professores'} value={''} />
          {teachers.map(t => (
            <Picker.Item key={t} label={t} value={t} />
          ))}
        </StyledPicker>

        <StyledFlatList>
          <FlatList
            data={filteredClasses as SubjectClasses[]}
            renderItem={renderClass}
            showsVerticalScrollIndicator={false}
            keyExtractor={(item, index) =>
              `${item.subject_id}-${item.classNumber}-${index}`
            }
          />
        </StyledFlatList>
      </ContentContainer>

      <ButtonsRow>
        <Button onPress={prevStep} size="small">
          Anterior
        </Button>
        <Button
          onPress={handleNextPress}
          size="small"
          disabled={isOverMaxClasses}
        >
          Próximo
        </Button>
      </ButtonsRow>
    </Container>
  );
};

export default ClassesStep;
