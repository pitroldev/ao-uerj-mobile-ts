import { useCurriculum } from '@root/modules/academics/presentation/queries';
import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import React, { useState } from 'react';
import { ListRenderItemInfo } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useFormContext, useWatch } from 'react-hook-form';
import { FontAwesome } from '@react-native-vector-icons/fontawesome';
import { FlatList } from 'react-native-gesture-handler';

import { useStepsContext } from '@hooks/useSteps';
import { normalizeText } from '@utils/normalize';

import { CurriculumSubject } from '@root/modules/academics/domain/models';

import { ScheduleCreationParams } from '@root/modules/planning/domain/models';

import Text from '@atoms/Text';
import Button from '@atoms/Button';
import Spinner from '@atoms/Spinner';
import TextInput from '@atoms/TextInput';
import StyledPicker from '@atoms/Picker';
import SubjectBox from '@molecules/SubjectBox';
import DummyMessage from '@molecules/DummyMessage';

import {
  Container,
  ContentContainer,
  ButtonsRow,
  StyledFlatList,
} from './SubjectsStep.styles';

const SubjectsStep = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectType, setSubjectType] = useState('');

  const { nextStep, prevStep } = useStepsContext();

  const query = useCurriculum();
  const { data = [], error, refetch, isLoading: loading } = query;

  const { handleSubmit, setValue, control } =
    useFormContext<ScheduleCreationParams>();

  const { min_subject_amount = 1, selectedSubjects = [] } = useWatch({
    control,
  });

  const handleNextPress = handleSubmit(nextStep);

  const handleSubjectPress = (subject: CurriculumSubject) => {
    const isSelected = selectedSubjects.some(s => s.id === subject.id);

    if (isSelected) {
      setValue(
        'selectedSubjects',
        selectedSubjects.filter(
          s => s.id !== subject.id,
        ) as CurriculumSubject[],
      );
      return;
    }

    const newSubjects = [...selectedSubjects, subject] as CurriculumSubject[];
    setValue('selectedSubjects', newSubjects);
  };

  const renderSubjects = ({
    item: subject,
  }: ListRenderItemInfo<CurriculumSubject>) => {
    const isSelected = selectedSubjects.some(s => s.id === subject.id);

    const { id, name, period, branch, credits, workload, minimum_credits } =
      subject;

    const creditsText = credits ? `${credits} créditos` : '';
    const workloadText = credits ? `${workload} horas` : '';

    const periodText = period ? `${period}º Período` : '';

    const ramificationText = branch
      ? `${periodText ? ' - ' : ''}Ramificação ${branch}`
      : '';

    const description = `${periodText}${ramificationText}`;

    const minCreditsText = minimum_credits
      ? `Trava de ${minimum_credits} créditos`
      : '';

    return (
      <SubjectBox
        topLeftInfo={id}
        topRightInfo={creditsText}
        name={name}
        color={isSelected ? 'FREE' : 'BUSY'}
        description={description}
        bottomLeftInfo={minCreditsText}
        bottomRightInfo={workloadText}
        boldOptions={{
          topLeft: true,
          name: true,
        }}
        onPress={() => handleSubjectPress(subject)}
      />
    );
  };

  const filteredData = data.filter(({ type, name, alreadyTaken }) => {
    if (alreadyTaken) {
      return false;
    }

    const hasSubjectType = !subjectType || type === subjectType;
    const hasSearchQuery =
      !searchQuery || normalizeText(name).includes(normalizeText(searchQuery));

    return hasSubjectType && hasSearchQuery;
  });

  const isEmpty = filteredData.length === 0;

  const isMinSubjectsAmountValid =
    selectedSubjects.length >= (min_subject_amount ?? 1);

  return (
    <Container>
      <ContentContainer>
        <QueryNotice
          dataUpdatedAt={query.dataUpdatedAt}
          isPaused={query.isPaused}
          isFetching={query.isFetching}
          error={error}
          hasData={query.data !== undefined}
          retry={refetch}
        />
        <Text weight="bold" size="LG" alignSelf="center" marginBottom="8px">
          Escolha {min_subject_amount} ou mais disciplinas
        </Text>

        <StyledPicker
          selectedValue={subjectType}
          onValueChange={s => setSubjectType(s as string)}
          loading={loading}
          enabled={!loading}
        >
          <Picker.Item label={'Todas'} value={''} />
          <Picker.Item label={'Disciplinas Obrigatórias'} value={'MANDATORY'} />
          <Picker.Item label={'Eletivas Restritas'} value={'RESTRICTED'} />
          <Picker.Item label={'Eletivas Definidas'} value={'DEFINED'} />
        </StyledPicker>

        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Pesquise pelo nome da disciplina"
          icon={<FontAwesome name="search" size={15} />}
        />

        <StyledFlatList>
          {!loading && (error as Error) && (
            <DummyMessage
              type="ERROR"
              onPress={refetch}
              text="Ops, ocorreu um erro ao buscar as disciplinas. Toque aqui para tentar novamente."
            />
          )}
          {!loading && !query.isPaused && !error && isEmpty && (
            <DummyMessage
              type="EMPTY"
              text="Parece que não há disciplinas a cursar nessa categoria."
            />
          )}
          {loading && <Spinner size={40} />}
          <FlatList
            data={filteredData}
            renderItem={renderSubjects}
            showsVerticalScrollIndicator={false}
            keyExtractor={(item, i) => i + item.id}
          />
        </StyledFlatList>
      </ContentContainer>

      <ButtonsRow>
        <Button onPress={prevStep} size="small" disabled={loading}>
          Anterior
        </Button>
        <Button
          onPress={handleNextPress}
          size="small"
          disabled={!isMinSubjectsAmountValid || loading}
        >
          Próximo
        </Button>
      </ButtonsRow>
    </Container>
  );
};

export default SubjectsStep;
