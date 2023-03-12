import React from 'react';
import {useQuery} from 'react-query';
import {useTheme} from 'styled-components';
import {TouchableOpacity} from 'react-native';
import {useFormContext, useWatch} from 'react-hook-form';
import Icon from 'react-native-vector-icons/AntDesign';

import {useAppSelector} from '@root/store';
import * as apiConfigReducer from '@reducers/apiConfig';
import {parseSubjectCode} from '@services/parser/minorParser';

import {useStepsContext} from '@hooks/useSteps';

import {fetchSubjectsTaken} from '@features/SubjectsTaken/core';
import {ScheduleCreationParams} from '@features/ScheduleSimulator/types';

import Text from '@atoms/Text';
import Button from '@atoms/Button';
import Spinner from '@atoms/Spinner';

import {
  Container,
  ContentContainer,
  ButtonsRow,
  InfoRow,
  ScrollView,
} from './FetchDataStep.styles';
import SubjectDataFetcher from './SubjectDataFetcher';

const FetchDataStep = () => {
  const {COLORS} = useTheme();
  const {nextStep, prevStep} = useStepsContext();

  const {cookies} = useAppSelector(apiConfigReducer.selectApiConfig);

  const {control, handleSubmit, setValue} =
    useFormContext<ScheduleCreationParams>();

  const subjects = useWatch({control, name: 'subjects'}) ?? [];
  const classes = useWatch({control, name: 'classes'}) ?? [];
  const selectedSubjects = useWatch({control, name: 'selectedSubjects'}) ?? [];
  const loadedClassesSubjectId =
    useWatch({control, name: 'loadedClassesSubjectId'}) ?? [];

  const handleNextPress = handleSubmit(nextStep);

  const {
    isFetching: loadingSubjectsTaken,
    error: errorSubjectsTaken,
    refetch,
    data: takenSubjects = [],
  } = useQuery({
    queryKey: ['subjects-taken', cookies],
    queryFn: fetchSubjectsTaken,
    onSuccess: data => {
      setValue('takenSubjects', data);
    },
  });

  const handleRefetch = () => {
    if (errorSubjectsTaken) {
      refetch();
    }
  };

  const credits = takenSubjects
    .filter(taken => taken.status === 'APPROVED')
    .reduce((acc, taken) => acc + (Number(taken?.credits) || 0), 0);

  const isSubjectDataFetched = selectedSubjects.every(subject => {
    const isCreditsSatisfied = credits >= (subject.minimum_credits ?? 0);
    if (!isCreditsSatisfied) {
      return true;
    }

    const code = parseSubjectCode(subject.id);
    const hasSubject = subjects.some(
      s => parseSubjectCode(s.id as string) === code,
    );

    const subjectClasses = classes.filter(
      s => parseSubjectCode(s.subject_id as string) === code,
    );

    const isClassLoaded = loadedClassesSubjectId.some(
      s => parseSubjectCode(s as string) === code,
    );

    const hasClasses = subjectClasses.length > 0 || isClassLoaded;
    return hasSubject && hasClasses;
  });

  const isAllDataFetched =
    isSubjectDataFetched && !errorSubjectsTaken && !loadingSubjectsTaken;

  return (
    <Container>
      <ContentContainer>
        <Text weight="bold" size="LG" alignSelf="center" marginBottom="10px">
          {isAllDataFetched
            ? 'Dados carregados com sucesso!'
            : 'Aguarde, buscando dados...'}
        </Text>

        <ScrollView>
          <TouchableOpacity onPress={handleRefetch}>
            <InfoRow>
              {loadingSubjectsTaken && !errorSubjectsTaken && (
                <Spinner size={20} />
              )}
              {!loadingSubjectsTaken && (
                <Icon
                  name={errorSubjectsTaken ? 'closecircle' : 'checkcircle'}
                  color={errorSubjectsTaken ? COLORS.ERROR : COLORS.SUCCESS}
                  size={20}
                />
              )}
              <Text weight="500" size="SM" marginLeft="8px" alignSelf="center">
                {errorSubjectsTaken && !loadingSubjectsTaken
                  ? 'Ocorreu um erro ao buscar as disciplinas realizadas. Toque aqui para tentar novamente.'
                  : 'Disciplinas realizadas'}
              </Text>
            </InfoRow>
          </TouchableOpacity>

          {!loadingSubjectsTaken &&
            !errorSubjectsTaken &&
            selectedSubjects.map(subject => (
              <SubjectDataFetcher key={subject.id} {...subject} />
            ))}
        </ScrollView>
      </ContentContainer>

      <ButtonsRow>
        <Button onPress={prevStep} size="small" disabled={!isAllDataFetched}>
          Anterior
        </Button>
        <Button
          onPress={handleNextPress}
          size="small"
          disabled={!isAllDataFetched}>
          Próximo
        </Button>
      </ButtonsRow>
    </Container>
  );
};

export default FetchDataStep;
