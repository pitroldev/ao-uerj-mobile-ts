import Button from '@atoms/Button';
import { useGenerateSchedules } from '@root/modules/planning/presentation/useGenerateSchedules';
import { AppError, errorMessage } from '@root/shared/errors/AppError';
import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useFormContext, useWatch } from 'react-hook-form';

import { useStepsContext } from '@hooks/useSteps';
import {
  ScheduleCreationParams,
  createScheduleDraft,
} from '@root/modules/planning/domain/models';

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

  const { setStep, prevStep } = useStepsContext();

  const { control, reset } = useFormContext<ScheduleCreationParams>();

  const body = useWatch({ control }) as ScheduleCreationParams;
  const generation = useGenerateSchedules();
  const { isPending: loading, data = [], error } = generation;
  const handleGenerate = () => {
    setSelectedIndex(0);
    generation.mutate(body);
  };

  const handleResetPress = () => {
    reset(createScheduleDraft());
    setStep(0);
  };

  const generatedSchedules = data;
  const selectedGeneration = generatedSchedules[selectedIndex];
  const selectedSchedule = selectedGeneration?.schedule;

  const hasData = data?.length > 0 && !error;
  const isEmpty = generation.isSuccess && data.length === 0;

  return (
    <Container>
      <ContentContainer>
        <Text weight="bold" alignSelf="center" marginBottom="8px">
          {loading
            ? 'Aguarde enquanto geramos sua grade'
            : generation.isIdle
            ? 'Tudo pronto para gerar sua grade'
            : 'Veja abaixo as grades geradas'}
        </Text>

        {generation.isIdle && (
          <Button onPress={handleGenerate}>Gerar grades</Button>
        )}
        {loading && <Spinner size="large" />}
        {(error as Error) && (
          <DummyMessage
            text={`${
              error instanceof AppError && error.code === 'INVALID_INPUT'
                ? error.message
                : errorMessage(error)
            } Toque aqui para tentar novamente.`}
            type="ERROR"
            onPress={handleGenerate}
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
              onValueChange={s => setSelectedIndex(s as number)}
            >
              {generatedSchedules.map((g, i) => (
                <Picker.Item key={g.hash} label={`Grade ${i + 1}`} value={i} />
              ))}
            </StyledPicker>

            <TabRow>
              <TabBtn
                active={currentTab === 'INFO'}
                onPress={() => setCurrentTab('INFO')}
              >
                <Text
                  weight="bold"
                  color={currentTab === 'INFO' ? 'PRIMARY' : 'BACKGROUND_400'}
                >
                  Informações
                </Text>
              </TabBtn>
              <TabBtn
                active={currentTab === 'SCHEDULE'}
                onPress={() => setCurrentTab('SCHEDULE')}
              >
                <Text
                  weight="bold"
                  color={
                    currentTab === 'SCHEDULE' ? 'PRIMARY' : 'BACKGROUND_400'
                  }
                >
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

      <ButtonsRow>
        <Button onPress={prevStep} size="small">
          Anterior
        </Button>
        {hasData && (
          <>
            <TouchableOpacity onPress={handleResetPress}>
              <Text weight="bold" color="PRIMARY">
                Gerar outra grade
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ButtonsRow>
    </Container>
  );
};

export default GenerationStep;
