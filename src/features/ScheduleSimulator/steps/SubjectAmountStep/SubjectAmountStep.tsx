import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import styled from 'styled-components/native';

import { useStepsContext } from '@hooks/useSteps';
import { FieldError, NumberStepper, Text } from '@components/ui';

import { ScheduleCreationParams } from '@root/modules/planning/domain/models';

import { GeneratorStep, StepIntro } from '../../layout';

const MIN_SUBJECTS_LIMIT = 1;
const MAX_SUBJECTS_LIMIT = 12;
const RANGE_MESSAGE = `Use um número de ${MIN_SUBJECTS_LIMIT} a ${MAX_SUBJECTS_LIMIT}.`;

const Question = styled.View`
  margin-top: 24px;
`;

const Label = styled(Text)`
  margin-bottom: 10px;
`;

/** Reserva a linha do erro (".err" min-height 18 + 6) para nada pular. */
const ErrorSlot = styled.View`
  min-height: 24px;
`;

type AmountField = 'min_subject_amount' | 'max_subject_amount';

function AmountQuestion({
  name,
  label,
  accessibilityLabel,
  requiredMessage,
}: {
  name: AmountField;
  label: string;
  accessibilityLabel: string;
  requiredMessage: string;
}) {
  const { control } = useFormContext<ScheduleCreationParams>();
  return (
    <Controller
      control={control}
      rules={{
        required: true,
        min: MIN_SUBJECTS_LIMIT,
        max: MAX_SUBJECTS_LIMIT,
      }}
      name={name}
      render={({ field: { onChange, value }, fieldState: { error } }) => {
        const message = !error
          ? null
          : error.type === 'required'
            ? requiredMessage
            : RANGE_MESSAGE;
        return (
          <Question>
            <Label variant="body" weight="medium">
              {label}
            </Label>
            <NumberStepper
              value={value === undefined || value === null ? '' : String(value)}
              onChangeText={(text: string) => {
                const newText = text.replace(/[^0-9]/g, '');
                const parsed = newText ? parseInt(newText, 10) : null;
                onChange(parsed);
              }}
              min={MIN_SUBJECTS_LIMIT}
              max={MAX_SUBJECTS_LIMIT}
              maxLength={2}
              unit="matérias"
              accessibilityLabel={accessibilityLabel}
              invalid={Boolean(error)}
            />
            <ErrorSlot>
              {message ? <FieldError message={message} /> : null}
            </ErrorSlot>
          </Question>
        );
      }}
    />
  );
}

const SubjectAmountStep = () => {
  const { nextStep } = useStepsContext();

  const {
    formState: { errors },
    handleSubmit,
    setValue,
  } = useFormContext<ScheduleCreationParams>();

  const handleNextPress = handleSubmit(data => {
    const { min_subject_amount, max_subject_amount } = data;
    if (min_subject_amount === null || max_subject_amount === null) return;

    if (min_subject_amount > max_subject_amount) {
      const swappedValues = {
        min_subject_amount: max_subject_amount,
        max_subject_amount: min_subject_amount,
      };

      setValue('min_subject_amount', swappedValues.min_subject_amount);
      setValue('max_subject_amount', swappedValues.max_subject_amount);
    }

    nextStep();
  });

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <GeneratorStep
      footer={{
        next: {
          label: 'Próximo',
          icon: 'arrow_forward',
          iconPosition: 'end',
          onPress: handleNextPress,
          disabled: hasErrors,
        },
      }}
    >
      <StepIntro
        title="Conte-nos um pouco sobre você"
        description={`Quantas disciplinas você quer cursar no próximo período? Vale de ${MIN_SUBJECTS_LIMIT} a ${MAX_SUBJECTS_LIMIT}.`}
      />
      <AmountQuestion
        name="min_subject_amount"
        label="Qual o mínimo de matérias que você quer cursar?"
        accessibilityLabel="mínimo de matérias"
        requiredMessage="O mínimo de matérias é obrigatório"
      />
      <AmountQuestion
        name="max_subject_amount"
        label="Qual o máximo de matérias que você quer cursar?"
        accessibilityLabel="máximo de matérias"
        requiredMessage="O máximo de matérias é obrigatório"
      />
    </GeneratorStep>
  );
};

export default SubjectAmountStep;
