import React, { useState } from 'react';
import type { ReportStepProps } from '../types';
import Text from '@atoms/Text';
import TextArea from '@atoms/TextArea';
import { Container, NextBtn } from './ExplanationStep.styles';

const ExplanationStep = ({ body, nextStep }: ReportStepProps) => {
  const [description, setDescription] = useState(body.description);
  return (
    <Container>
      <Text italic marginTop="8px" marginBottom="8px">
        Descreva o que aconteceu e o resultado esperado
      </Text>
      <TextArea
        value={description}
        onChangeText={setDescription}
        maxLength={4000}
      />
      <NextBtn
        size="small"
        fullWidth
        disabled={!description.trim()}
        onPress={() => nextStep({ description })}
      >
        Enviar relato
      </NextBtn>
    </Container>
  );
};

export default ExplanationStep;
