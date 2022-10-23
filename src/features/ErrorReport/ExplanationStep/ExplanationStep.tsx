import React, {useState} from 'react';

import {ErrorReportBody} from '../types';

import Text from '@atoms/Text';
import TextArea from '@atoms/TextArea';

import {Container, NextBtn} from './ExplanationStep.styles';

type Props = {
  nextStep: () => void;
  setBody: React.Dispatch<React.SetStateAction<ErrorReportBody>>;
};

const ExplanationStep = ({nextStep, setBody}: Props) => {
  const [description, setDescription] = useState<string>('');

  const handleOnPress = () => {
    setBody(b => Object.assign(b, {description}));
    nextStep();
  };

  return (
    <Container>
      <Text italic marginTop="8px" marginBottom="8px">
        Descreva o erro em poucas palavras
      </Text>
      <TextArea onChangeText={setDescription} />
      <NextBtn size="small" fullWidth onPress={handleOnPress}>
        Próximo
      </NextBtn>
    </Container>
  );
};

export default ExplanationStep;
