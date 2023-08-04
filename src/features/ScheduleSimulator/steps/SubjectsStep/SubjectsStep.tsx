import React, {useState} from 'react';
import {ListRenderItemInfo} from 'react-native';
import {useQuery} from 'react-query';
import {Picker} from '@react-native-picker/picker';
import {useFormContext, useWatch} from 'react-hook-form';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import {FlatList} from 'react-native-gesture-handler';

import {useStepsContext} from '@hooks/useSteps';
import {normalizeText} from '@utils/normalize';

import {useAppDispatch, useAppSelector} from '@root/store';
import * as apiConfigReducer from '@reducers/apiConfig';

import {SubjectToTake} from '@features/SubjectsToTake/types';
import {fetchSubjectsToTake} from '@features/SubjectsToTake/core';
import * as subjectsToTakeReducer from '@features/SubjectsToTake/reducer';

import {ScheduleCreationParams} from '@features/ScheduleSimulator/types';

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

  const dispatch = useAppDispatch();
  const {nextStep, prevStep} = useStepsContext();

  const {cookies} = useAppSelector(apiConfigReducer.selectApiConfig);
  const {data} = useAppSelector(subjectsToTakeReducer.selectSubjectsToTake);

  const {handleSubmit, setValue, control} =
    useFormContext<ScheduleCreationParams>();

  const {min_subject_amount = 3, selectedSubjects = []} = useWatch({control});

  const {isFetching, error, refetch} = useQuery({
    queryKey: ['subjects-to-take', cookies],
    queryFn: fetchSubjectsToTake,
    onSuccess: d => {
      dispatch(subjectsToTakeReducer.setState(d));
    },
  });

  const loading = isFetching && !data;

  const handleNextPress = handleSubmit(nextStep);

  const handleSubjectPress = (subject: SubjectToTake) => {
    const isSelected = selectedSubjects.some(s => s.id === subject.id);

    if (isSelected) {
      setValue(
        'selectedSubjects',
        selectedSubjects.filter(s => s.id !== subject.id) as SubjectToTake[],
      );
      return;
    }

    const newSubjects = [...selectedSubjects, subject] as SubjectToTake[];
    setValue('selectedSubjects', newSubjects);
  };

  const renderSubjects = ({
    item: subject,
  }: ListRenderItemInfo<SubjectToTake>) => {
    const isSelected = selectedSubjects.some(s => s.id === subject.id);

    const {
      has_prerequisites,
      allow_conflict,
      id,
      minimum_credits,
      name,
      period,
      branch,
      group,
    } = subject;

    const requirementText = has_prerequisites ? '' : 'Não possui pré-requisito';
    const conflictText = allow_conflict ? 'Permite conflito' : '';

    const creditsText = minimum_credits
      ? `Trava de ${minimum_credits} créditos`
      : '';

    const periodText = period ? `${period}º Período` : '';

    const ramificationText = branch
      ? `${periodText ? ' - ' : ''}Ramificação ${branch}`
      : '';

    const groupText = group
      ? `${ramificationText ? ' - ' : ''}Grupo ${group}`
      : '';

    const description = `${periodText}${ramificationText}${groupText}`;

    return (
      <SubjectBox
        topLeftInfo={id}
        topRightInfo={creditsText}
        name={name}
        color={isSelected ? 'FREE' : 'BUSY'}
        description={description}
        bottomLeftInfo={requirementText}
        bottomRightInfo={conflictText}
        boldOptions={{
          topLeft: true,
          name: true,
        }}
        onPress={() => handleSubjectPress(subject)}
      />
    );
  };

  const filteredData = data.filter(({type, name}) => {
    const hasSubjectType = !subjectType || type === subjectType;
    const hasSearchQuery =
      !searchQuery || normalizeText(name).includes(normalizeText(searchQuery));

    return hasSubjectType && hasSearchQuery;
  });

  const isEmpty = filteredData.length === 0;

  const isMinSubjectsAmountValid =
    selectedSubjects.length >= (min_subject_amount as number) ||
    data.length < (min_subject_amount as number);

  return (
    <Container>
      <ContentContainer>
        <Text weight="bold" size="LG" alignSelf="center" marginBottom="8px">
          Escolha {min_subject_amount} ou mais disciplinas
        </Text>

        <StyledPicker
          selectedValue={subjectType}
          onValueChange={s => setSubjectType(s as string)}
          loading={loading}
          enabled={!loading}>
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
          {!loading && error && (
            <DummyMessage
              type="ERROR"
              onPress={refetch}
              text="Ops, ocorreu um erro ao buscar as disciplinas. Toque aqui para tentar novamente."
            />
          )}
          {!loading && !error && isEmpty && (
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
            keyExtractor={(_, index) => index.toString()}
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
          disabled={!isMinSubjectsAmountValid || loading}>
          Próximo
        </Button>
      </ButtonsRow>
    </Container>
  );
};

export default SubjectsStep;
