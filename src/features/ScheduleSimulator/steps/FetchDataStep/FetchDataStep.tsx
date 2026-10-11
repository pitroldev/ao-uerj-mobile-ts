import React from 'react';
import { useTheme } from 'styled-components/native';
import { useFormContext, useWatch } from 'react-hook-form';
import { AntDesign as Icon } from '@react-native-vector-icons/ant-design';
import { useStepsContext } from '@hooks/useSteps';
import { useHistory } from '@root/modules/academics/presentation/queries';
import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import { usePlanningSubjects } from '@root/modules/planning/presentation/usePlanningSubjects';
import { ScheduleCreationParams } from '@root/modules/planning/domain/models';
import { availableClasses } from '@root/modules/planning/domain/rules';
import Text from '@atoms/Text';
import Button from '@atoms/Button';
import Spinner from '@atoms/Spinner';
import DummyMessage from '@molecules/DummyMessage';
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
  const { control, setValue, getValues } =
    useFormContext<ScheduleCreationParams>();
  const selectedSubjects = useWatch({ control, name: 'selectedSubjects' });
  const history = useHistory();
  const progress = usePlanningSubjects(selectedSubjects, history.data);
  const complete =
    history.isSuccess &&
    progress.completed === selectedSubjects.length &&
    !progress.loading &&
    selectedSubjects.length > 0;
  const hasErrors = progress.results.some(result => result.error);
  const handleNext = () => {
    if (!complete || hasErrors || !history.data) return;
    const subjects = progress.results
      .filter(result => result.eligible)
      .map(result => result.details!);
    setValue('subjects', subjects);
    setValue('takenSubjects', history.data);
    setValue(
      'selectedClasses',
      availableClasses(subjects, getValues('busy_schedules')),
    );
    nextStep();
  };
  return (
    <Container>
      <ContentContainer>
        <Text weight="bold" size="LG" alignSelf="center" marginBottom="10px">
          {complete && !hasErrors
            ? 'Dados carregados com sucesso!'
            : complete
            ? 'Busca concluída com falhas'
            : 'Buscando dados das disciplinas'}
        </Text>
        <QueryNotice
          dataUpdatedAt={history.dataUpdatedAt}
          isPaused={history.isPaused}
          isFetching={history.isFetching}
          error={history.error}
          hasData={history.data !== undefined}
          retry={history.refetch}
        />
        {history.error && !history.data && (
          <DummyMessage
            type="ERROR"
            text="Não foi possível carregar o histórico. Toque para tentar novamente."
            onPress={history.refetch}
          />
        )}
        <Text size="SM" alignSelf="center">
          {progress.completed} de {selectedSubjects.length} disciplinas
          processadas
        </Text>
        {(progress.loading || history.isLoading) && <Spinner size={28} />}
        <ScrollView>
          {progress.results.map(result => (
            <InfoRow key={result.subject.id}>
              <Icon
                name={
                  result.error || !result.eligible
                    ? 'close-circle'
                    : 'check-circle'
                }
                color={
                  result.error || !result.eligible
                    ? COLORS.ERROR
                    : COLORS.SUCCESS
                }
                size={20}
              />
              <Text weight="500" size="SM" marginLeft="8px">
                {result.subject.name}
                {result.error
                  ? ': falha ao carregar.'
                  : result.reason
                  ? `: ${result.reason}`
                  : ''}
              </Text>
            </InfoRow>
          ))}
        </ScrollView>
        {hasErrors && !progress.loading && (
          <Button onPress={progress.retry}>Tentar novamente</Button>
        )}
      </ContentContainer>
      <ButtonsRow>
        <Button onPress={prevStep} size="small">
          Anterior
        </Button>
        <Button
          onPress={handleNext}
          size="small"
          disabled={
            !complete ||
            hasErrors ||
            !progress.results.some(result => result.eligible)
          }
        >
          Próximo
        </Button>
      </ButtonsRow>
    </Container>
  );
};
export default FetchDataStep;
