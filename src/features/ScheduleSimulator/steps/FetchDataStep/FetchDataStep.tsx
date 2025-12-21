import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'styled-components';
import { TouchableOpacity } from 'react-native';
import { useFormContext, useWatch } from 'react-hook-form';
import { AntDesign as Icon } from '@react-native-vector-icons/ant-design';

import { useAppSelector } from '@root/store';
import * as apiConfigReducer from '@reducers/apiConfig';

import { useStepsContext } from '@hooks/useSteps';

import { fetchSubjectsTaken } from '@features/SubjectsTaken/core';
import { ScheduleCreationParams } from '@features/ScheduleSimulator/types';

import Text from '@atoms/Text';
import Button from '@atoms/Button';
import Spinner from '@atoms/Spinner';

import SubjectDataFetcher from './SubjectDataFetcher';
import {
  Container,
  ContentContainer,
  ButtonsRow,
  InfoRow,
  ScrollView,
} from './FetchDataStep.styles';

const FetchDataStep = () => {
  const { COLORS } = useTheme();
  const { nextStep, prevStep } = useStepsContext();
  const [loadedSubjects, setLoadedSubjects] = useState<string[]>([]);

  const { cookies, createdAt } = useAppSelector(
    apiConfigReducer.selectApiConfig,
  );

  const { control, handleSubmit, setValue } =
    useFormContext<ScheduleCreationParams>();

  const { selectedSubjects } = useWatch({ control }) as ScheduleCreationParams;

  const handleNextPress = handleSubmit(nextStep);

  const {
    data: subjectsTakenData,
    isLoading: loadingSubjectsTaken,
    error: errorSubjectsTaken,
    refetch,
  } = useQuery({
    queryKey: ['subjects-taken', cookies, createdAt],
    queryFn: fetchSubjectsTaken,
  });

  useEffect(() => {
    if (!subjectsTakenData) return;
    setValue('takenSubjects', subjectsTakenData);
  }, [subjectsTakenData]);

  useEffect(() => {
    setLoadedSubjects([]);
  }, []);

  const handleSubjectLoaded = (subjectId: string) => {
    setLoadedSubjects(prev =>
      prev.includes(subjectId) ? prev : [...prev, subjectId],
    );
  };

  const handleSubjectError = (subjectId: string) => {
    setLoadedSubjects(prev => prev.filter(id => id !== subjectId));
  };

  const handleRefetch = () => {
    if (errorSubjectsTaken) {
      refetch();
    }
  };

  const isSubjectDataFetched =
    selectedSubjects?.length > 0
      ? selectedSubjects.every(subject => loadedSubjects.includes(subject.id))
      : false;

  const isTakenSubjectsFetched = !errorSubjectsTaken && !loadingSubjectsTaken;
  const isAllDataFetched = isTakenSubjectsFetched && isSubjectDataFetched;
  const totalSubjects = selectedSubjects?.length ?? 0;

  return (
    <Container>
      <ContentContainer>
        <Text weight="bold" size="LG" alignSelf="center" marginBottom="10px">
          {isAllDataFetched
            ? 'Dados carregados com sucesso!'
            : 'Aguarde, buscando dados...'}
        </Text>
        {!isAllDataFetched && (
          <Text
            size="XS"
            alignSelf="center"
            marginBottom="6px"
            color="BACKGROUND_700"
          >
            Disciplinas selecionadas: {totalSubjects}
          </Text>
        )}

        <ScrollView>
          <TouchableOpacity
            onPress={handleRefetch}
            disabled={loadingSubjectsTaken}
          >
            <InfoRow>
              {loadingSubjectsTaken && !errorSubjectsTaken && (
                <Spinner size={20} />
              )}
              {!loadingSubjectsTaken && (
                <Icon
                  name={errorSubjectsTaken ? 'close-circle' : 'check-circle'}
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
            selectedSubjects?.map(subject => (
              <SubjectDataFetcher
                key={subject.id}
                {...subject}
                onSubjectLoaded={handleSubjectLoaded}
                onSubjectError={handleSubjectError}
              />
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
          disabled={!isAllDataFetched}
        >
          Próximo
        </Button>
      </ButtonsRow>
    </Container>
  );
};

export default FetchDataStep;
