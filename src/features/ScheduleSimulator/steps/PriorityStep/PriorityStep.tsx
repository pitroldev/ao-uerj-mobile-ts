import React from 'react';
import {useFormContext, useWatch} from 'react-hook-form';

import {useStepsContext} from '@hooks/useSteps';

import {
  Priority,
  ScheduleCreationParams,
} from '@features/ScheduleSimulator/types';

import Text from '@atoms/Text';
import Button from '@atoms/Button';

import {
  Column,
  Container,
  Row,
  Switch,
  ScrollView,
  ContentContainer,
  ButtonsRow,
} from './PriorityStep.styles';

const orderedPriorities = [
  'MIN_GAPS',
  'LIVES_FAR_AWAY',
  'CRITICAL_FIRST',
  'MAX_DAY_WORKLOAD',
  'MIN_DAY_WORKLOAD',
  'MAX_WORKLOAD',
  'MIN_WORKLOAD',
  'MANDATORY_CLASSES',
  'MAX_CREDITS',
] as const;

const priorities = [
  [
    {
      key: 'LIVES_FAR_AWAY',
      label: 'Evitar muito deslocamento, moro longe da UERJ',
    },
  ],
  [{key: 'MIN_GAPS', label: 'Evitar intervalos grandes entre matérias'}],
  [{key: 'MANDATORY_CLASSES', label: 'Matérias obrigatórias'}],
  [
    {
      key: 'CRITICAL_FIRST',
      label: 'Matérias críticas (que travam outras matérias)',
    },
  ],
  [{key: 'MAX_CREDITS', label: 'Máximo de créditos possíveis'}],
  [
    {key: 'MIN_DAY_WORKLOAD', label: 'Pouca carga horária diária'},
    {key: 'MAX_DAY_WORKLOAD', label: 'Muita carga horária diária'},
  ],
  [
    {key: 'MIN_WORKLOAD', label: 'Pouca carga horária semanal'},
    {key: 'MAX_WORKLOAD', label: 'Muita carga horária semanal'},
  ],
] as const;

const PriorityStep = () => {
  const {nextStep, prevStep} = useStepsContext();

  const {control, handleSubmit, setValue} =
    useFormContext<ScheduleCreationParams>();

  const priority = useWatch({control, name: 'priority'}) ?? [];

  const handleNextPress = handleSubmit(data => {
    const orderedPriority = orderedPriorities.filter(key =>
      data.priority.includes(key),
    );

    setValue('priority', orderedPriority);
    nextStep();
  });

  const handleCheckBoxChange = (checked: boolean, key: Priority) => {
    if (!checked) {
      setValue(
        'priority',
        priority.filter((p: string) => p !== key),
      );
      return;
    }

    const filteredPriorities = priority.filter(name => {
      const group = priorities.find(g => g.some(p => p.key === name));

      return group && !group.some(p => p.key === key);
    });
    const newPriority = [...filteredPriorities, key];
    setValue('priority', newPriority);
  };

  return (
    <Container>
      <ContentContainer>
        <Text weight="bold" size="LG" alignSelf="center" marginBottom="10px">
          Quais são suas prioridades?
        </Text>

        <ScrollView>
          {priorities.map((group, index) => (
            <Column key={index}>
              {group.map(({key, label}) => (
                <Row key={key}>
                  <Text weight="500" size="SM" marginLeft="5px">
                    {label}
                  </Text>

                  <Switch
                    value={priority.includes(key)}
                    onValueChange={(v: boolean) => handleCheckBoxChange(v, key)}
                  />
                </Row>
              ))}
            </Column>
          ))}
        </ScrollView>
      </ContentContainer>
      <ButtonsRow>
        <Button onPress={prevStep} size="small">
          Anterior
        </Button>
        <Button onPress={handleNextPress} size="small">
          Próximo
        </Button>
      </ButtonsRow>
    </Container>
  );
};

export default PriorityStep;
