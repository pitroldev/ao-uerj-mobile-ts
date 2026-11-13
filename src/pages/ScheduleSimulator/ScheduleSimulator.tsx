import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';

import { StepsProvider, useSteps } from '@hooks/useSteps';

import {
  GeneratorDraft,
  createGeneratorDraft,
} from '@root/modules/planning/domain/models';

import { SubjectsStep } from '@features/ScheduleSimulator/steps/SubjectsStep';
import { RoutineStep } from '@features/ScheduleSimulator/steps/RoutineStep';
import { ResultsStep } from '@features/ScheduleSimulator/steps/ResultsStep';
import { CriticalityProvider } from '@features/ScheduleSimulator/criticality/CriticalityProvider';
import { GeneratorRunRecorder } from '@features/ScheduleSimulator/GeneratorRunRecorder';

/**
 * O gerador em três passos: o que cursar, quando não pode ter aula e as
 * grades. Cada passo desenha o próprio painel (`GeneratorStep`): trilho de
 * passos no topo, conteúdo e rodapé.
 */
const steps = [SubjectsStep, RoutineStep, ResultsStep];

export const ScheduleCreationPage = () => {
  const methods = useForm<GeneratorDraft>({
    mode: 'all',
    defaultValues: createGeneratorDraft(),
  });

  const { step, nextStep, prevStep, setStep } = useSteps({
    initialStep: 0,
    maxStep: steps.length - 1,
  });

  const CurrentStep = steps[step] ?? null;

  return (
    <FormProvider {...methods}>
      {/* aqui, e não no passo: a leitura dos pré-requisitos segue entre os passos */}
      <CriticalityProvider>
        <StepsProvider values={{ step, nextStep, prevStep, setStep }}>
          <GeneratorRunRecorder step={step} />
          {CurrentStep && <CurrentStep />}
        </StepsProvider>
      </CriticalityProvider>
    </FormProvider>
  );
};
