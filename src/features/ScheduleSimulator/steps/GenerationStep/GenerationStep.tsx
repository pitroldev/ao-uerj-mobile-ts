import React from 'react';
import {useQuery} from 'react-query';
import {TouchableOpacity} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import {useFormContext, useWatch} from 'react-hook-form';

import {useAppSelector} from '@root/store';
import * as reducer from '@features/SubjectsToTake/reducer';

import api from '@services/ScheduleApi';
import {useStepsContext} from '@hooks/useSteps';
import {parseSubjectCode} from '@services/parser/minorParser';
import {
  parseClassToGeneratorFormat,
  parseSubjectToGeneratorFormat,
} from '@utils/converter';
import {
  GeneratedSchedule,
  ScheduleCreationParams,
} from '@features/ScheduleSimulator/types';

import Text from '@atoms/Text';
import Spinner from '@atoms/Spinner';
import StyledPicker from '@atoms/Picker';
import DummyMessage from '@molecules/DummyMessage';

import ScheduleVisualizer from '../../ScheduleVisualizer';
import ScheduleInfo from '../../ScheduleInfo';

import {
  ButtonsRow,
  Container,
  ContentContainer,
  TabBtn,
  TabRow,
} from './GenerationStep.styles';

const GenerationStep = () => {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [currentTab, setCurrentTab] = React.useState<'INFO' | 'SCHEDULE'>(
    'INFO',
  );

  const {setStep} = useStepsContext();

  const {control} = useFormContext<ScheduleCreationParams>();

  const body = useWatch({control}) as ScheduleCreationParams;
  const {data: subjectsToTake} = useAppSelector(reducer.selectSubjectsToTake);

  const preferences = {
    min_subject_amount: body.min_subject_amount,
    max_subject_amount: body.max_subject_amount,
    priority: body.priority,
    busy_schedules: body.busy_schedules,
  };

  const classes = body.selectedClasses.map(c => {
    const subject = body.subjects.find(
      s => parseSubjectCode(s.id as string) === parseSubjectCode(c.subject_id),
    )!;

    return parseClassToGeneratorFormat(c, subject);
  });

  const subjects = body.subjects.map(s => {
    const subjectToTake = subjectsToTake.find(
      subject =>
        parseSubjectCode(subject.id) === parseSubjectCode(s.id as string),
    )!;

    return parseSubjectToGeneratorFormat(subjectToTake, s);
  });

  const {
    isFetching: loading,
    data,
    error,
    refetch,
  } = useQuery({
    queryKey: ['schedule-generation', body],
    initialData: [] as GeneratedSchedule[],
    queryFn: async () => {
      const res = await api.post('/generate', {
        preferences,
        classes,
        subjects,
      });

      return res.data.data as GeneratedSchedule[];
    },
  });

  const handleResetPress = () => {
    setStep(0);
  };

  const generatedSchedules = (data ?? []) as GeneratedSchedule[];
  const selectedGeneration = generatedSchedules[selectedIndex];
  const selectedSchedule = selectedGeneration?.schedule;

  const hasData = data && data?.length > 0 && !error;

  const isEmpty = data && data?.length === 0 && !loading;

  return (
    <Container>
      <ContentContainer>
        <Text weight="bold" alignSelf="center" marginBottom="8px">
          {loading
            ? 'Aguarde enquanto geramos sua grade'
            : 'Veja abaixo as grades geradas'}
        </Text>

        {loading && <Spinner size="large" />}
        {error && (
          <DummyMessage
            text="Ocorreu um erro ao gerar as grades, toque aqui para tentar novamente"
            type="ERROR"
            onPress={refetch}
          />
        )}
        {isEmpty && (
          <DummyMessage
            text="Não foi possível gerar nenhuma grade com os dados informados, clique aqui para gerar outra grade"
            type="EMPTY"
            onPress={handleResetPress}
          />
        )}

        {hasData && (
          <>
            <StyledPicker
              selectedValue={selectedIndex}
              onValueChange={s => setSelectedIndex(s as number)}>
              {generatedSchedules.map((g, i) => (
                <Picker.Item key={g.hash} label={`Grade ${i + 1}`} value={i} />
              ))}
            </StyledPicker>

            <TabRow>
              <TabBtn
                active={currentTab === 'INFO'}
                onPress={() => setCurrentTab('INFO')}>
                <Text
                  weight="bold"
                  color={currentTab === 'INFO' ? 'PRIMARY' : 'BACKGROUND_400'}>
                  Informações
                </Text>
              </TabBtn>
              <TabBtn
                active={currentTab === 'SCHEDULE'}
                onPress={() => setCurrentTab('SCHEDULE')}>
                <Text
                  weight="bold"
                  color={
                    currentTab === 'SCHEDULE' ? 'PRIMARY' : 'BACKGROUND_400'
                  }>
                  Horários
                </Text>
              </TabBtn>
            </TabRow>
            {currentTab === 'SCHEDULE' && (
              <ScheduleVisualizer data={selectedSchedule} />
            )}
            {currentTab === 'INFO' && selectedGeneration && (
              <ScheduleInfo {...selectedGeneration} />
            )}
          </>
        )}
      </ContentContainer>

      {hasData && (
        <ButtonsRow>
          <TouchableOpacity onPress={handleResetPress}>
            <Text weight="bold" color="PRIMARY">
              Gerar outra grade
            </Text>
          </TouchableOpacity>
        </ButtonsRow>
      )}
    </Container>
  );
};

export default GenerationStep;
