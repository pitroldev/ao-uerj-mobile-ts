import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';

import StepsProvider, { useSteps } from '@hooks/useSteps';

import {
  ScheduleCreationParams,
  createScheduleDraft,
} from '@root/modules/planning/domain/models';

import SubjectAmountStep from '@features/ScheduleSimulator/steps/SubjectAmountStep';
import BusyHoursStep from '@features/ScheduleSimulator/steps/BusyHoursStep';
import PriorityStep from '@features/ScheduleSimulator/steps/PriorityStep';
import SubjectsStep from '@features/ScheduleSimulator/steps/SubjectsStep';
import FetchDataStep from '@features/ScheduleSimulator/steps/FetchDataStep';
import ClassesStep from '@features/ScheduleSimulator/steps/ClassesStep';
import GenerationStep from '@features/ScheduleSimulator/steps/GenerationStep';

/**
 * Cada passo desenha o próprio painel (`GeneratorStep`): trilho de passos no
 * topo, conteúdo e rodapé Anterior/Próximo.
 */
const steps = [
  SubjectAmountStep,
  BusyHoursStep,
  PriorityStep,
  SubjectsStep,
  FetchDataStep,
  ClassesStep,
  GenerationStep,
];

const ScheduleCreationPage = () => {
  const methods = useForm<ScheduleCreationParams>({
    mode: 'all',
    defaultValues: createScheduleDraft(),
  });

  const { step, nextStep, prevStep, setStep } = useSteps({
    initialStep: 0,
    maxStep: steps.length - 1,
  });

  const CurrentStep = steps[step] ?? null;

  return (
    <FormProvider {...methods}>
      <StepsProvider values={{ step, nextStep, prevStep, setStep }}>
        {CurrentStep && <CurrentStep />}
      </StepsProvider>
    </FormProvider>
  );
};

export default ScheduleCreationPage;
