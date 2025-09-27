import React, { useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';

import StepsProvider, { useSteps } from '@hooks/useSteps';

import SubjectAmountStep from '@features/ScheduleSimulator/steps/SubjectAmountStep';
import { ScheduleCreationParams } from '@features/ScheduleSimulator/types';

import BusyHoursStep from '@features/ScheduleSimulator/steps/BusyHoursStep';
import PriorityStep from '@features/ScheduleSimulator/steps/PriorityStep';
import SubjectsStep from '@features/ScheduleSimulator/steps/SubjectsStep';
import FetchDataStep from '@features/ScheduleSimulator/steps/FetchDataStep';
import ClassesStep from '@features/ScheduleSimulator/steps/ClassesStep';
import GenerationStep from '@features/ScheduleSimulator/steps/GenerationStep';

import { Container } from './ScheduleSimulator.styles';

const steps = [
  {
    name: 'SubjectAmountStep',
    component: () => <SubjectAmountStep />,
  },
  {
    name: 'BusyHoursStep',
    component: () => <BusyHoursStep />,
  },
  {
    name: 'PriorityStep',
    component: () => <PriorityStep />,
  },
  {
    name: 'SubjectsStep',
    component: () => <SubjectsStep />,
  },
  {
    name: 'FetchDataStep',
    component: () => <FetchDataStep />,
  },
  {
    name: 'ClassesStep',
    component: () => <ClassesStep />,
  },
  {
    name: 'GenerationStep',
    component: () => <GenerationStep />,
  },
];

const ScheduleCreationPage = () => {
  const defaultValues: ScheduleCreationParams = {
    min_subject_amount: null,
    max_subject_amount: null,
    busy_schedules: [],
    priority: ['MOST_SUBJECTS_POSSIBLE'],
    subjectsToTake: [],
    selectedSubjects: [],
    takenSubjects: [],
    subjects: [],
    selectedClasses: [],
  };

  const methods = useForm<ScheduleCreationParams>({
    mode: 'all',
    defaultValues,
  });

  const { step, nextStep, prevStep, setStep } = useSteps({
    initialStep: 0,
    maxStep: steps.length - 1,
  });

  useEffect(() => {
    if (step === 0) {
      methods.reset(defaultValues);
    }
  }, [step]);

  const CurrentStep = steps[step]?.component ?? null;

  return (
    <FormProvider {...methods}>
      <StepsProvider values={{ step, nextStep, prevStep, setStep }}>
        <Container>{CurrentStep && <CurrentStep />}</Container>
      </StepsProvider>
    </FormProvider>
  );
};

export default ScheduleCreationPage;
