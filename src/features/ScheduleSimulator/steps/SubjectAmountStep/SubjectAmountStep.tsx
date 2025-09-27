import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';

import { useStepsContext } from '@hooks/useSteps';

import { ScheduleCreationParams } from '@features/ScheduleSimulator/types';

import Text from '@atoms/Text';
import Button from '@atoms/Button';
import TextInput from '@atoms/TextInput';

import {
  Container,
  ContentContainer,
  ButtonsRow,
  Column,
} from './SubjectAmountStep.styles';

const MIN_SUBJECTS_LIMIT = 3;
const MAX_SUBJECTS_LIMIT = 12;

const SubjectAmountStep = () => {
  const { nextStep } = useStepsContext();

  const {
    control,
    formState: { errors },
    handleSubmit,
    setValue,
  } = useFormContext<ScheduleCreationParams>();

  const handleNextPress = handleSubmit(data => {
    const { min_subject_amount, max_subject_amount } = data as {
      min_subject_amount: number;
      max_subject_amount: number;
    };

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
    <Container>
      <ContentContainer>
        <Text weight="bold" size="LG" alignSelf="center" marginBottom="10px">
          Conte-nos um pouco sobre você
        </Text>

        <Column>
          <Text weight="500" size="SM" marginLeft="5px">
            Qual o mínimo de matérias que você quer cursar?
          </Text>
          <Controller
            control={control}
            rules={{
              required: true,
              min: MIN_SUBJECTS_LIMIT,
              max: MAX_SUBJECTS_LIMIT,
            }}
            name="min_subject_amount"
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={
                  value === undefined || value === null ? '' : String(value)
                }
                keyboardType="number-pad"
                onChangeText={(text: string) => {
                  const newText = text.replace(/[^0-9]/g, '');
                  const parsed = newText ? parseInt(newText, 10) : undefined;
                  onChange(parsed as unknown as number);
                }}
              />
            )}
          />
          <Text weight="500" size="XS" marginLeft="5px" color="ERROR">
            {errors.min_subject_amount?.type === 'required' &&
              'O mínimo de matérias é obrigatório'}
            {errors.min_subject_amount?.type === 'min' &&
              `O mínimo de matérias deve ser no mínimo ${MIN_SUBJECTS_LIMIT}`}
            {errors.min_subject_amount?.type === 'max' &&
              `O mínimo de matérias deve ser no máximo ${MAX_SUBJECTS_LIMIT}`}
          </Text>
        </Column>

        <Column>
          <Text weight="500" size="SM" marginLeft="5px">
            Qual o máximo de matérias que você quer cursar?
          </Text>
          <Controller
            control={control}
            rules={{
              required: true,
              min: MIN_SUBJECTS_LIMIT,
              max: MAX_SUBJECTS_LIMIT,
            }}
            name="max_subject_amount"
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={
                  value === undefined || value === null ? '' : String(value)
                }
                onChangeText={(text: string) => {
                  const newText = text.replace(/[^0-9]/g, '');
                  const parsed = newText ? parseInt(newText, 10) : undefined;
                  onChange(parsed as unknown as number);
                }}
                keyboardType="number-pad"
              />
            )}
          />
          <Text weight="500" size="XS" marginLeft="5px" color="ERROR">
            {errors.max_subject_amount?.type === 'required' &&
              'O máximo de matérias é obrigatório'}
            {errors.max_subject_amount?.type === 'min' &&
              `O máximo de matérias deve ser no mínimo ${MIN_SUBJECTS_LIMIT}`}
            {errors.max_subject_amount?.type === 'max' &&
              `O máximo de matérias deve ser no máximo ${MAX_SUBJECTS_LIMIT}`}
          </Text>
        </Column>
      </ContentContainer>

      <ButtonsRow>
        <Button onPress={handleNextPress} fullWidth disabled={hasErrors}>
          Próximo
        </Button>
      </ButtonsRow>
    </Container>
  );
};

export default SubjectAmountStep;
