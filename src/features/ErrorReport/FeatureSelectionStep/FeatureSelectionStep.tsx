import React, {useState} from 'react';
import {Picker} from '@react-native-picker/picker';

import parser from '@services/parser';

import {executeErrorCallbacks, PRIVATE_ROUTES} from '../core';
import {ErrorReportBody, ErrorFeature} from '../types';

import Text from '@atoms/Text';
import TextInput from '@atoms/TextInput';
import StyledPicker from '@atoms/Picker';
import {Container, NextBtn} from './FeatureSelectionStep.styles';

type Props = {
  nextStep: () => void;
  setBody: React.Dispatch<React.SetStateAction<ErrorReportBody>>;
};

const FeatureSelectionStep = ({nextStep, setBody}: Props) => {
  const [page, setPage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [subjectCode, setSubjectCode] = useState('');

  const withCodeInput = page === 'Informações de uma disciplina específica';

  const handleFetchData = async () => {
    setLoading(true);
    const {callbacks} = PRIVATE_ROUTES.find(
      c => c.name === page,
    ) as ErrorFeature;
    if (withCodeInput) {
      const code = parser.parseSubjectCode(subjectCode) as number;
      const populatedCallbacks = callbacks.map(
        (c: (n: number) => Promise<string>) => () => c(code),
      );
      const html = await executeErrorCallbacks(populatedCallbacks);
      setBody(b => Object.assign(b, {html}));
    } else {
      const html = await executeErrorCallbacks(callbacks);
      setBody(b => Object.assign(b, {html}));
    }
    setLoading(false);
  };

  const handleOnPress = async () => {
    await handleFetchData();
    setBody(b => Object.assign(b, {page}));
    nextStep();
  };

  return (
    <Container>
      <Text italic marginTop="8px" marginBottom="4px">
        Onde o erro aconteceu?
      </Text>
      <StyledPicker
        selectedValue={page}
        onValueChange={s => setPage(s as string)}
        enabled={!loading}>
        <Picker.Item value="" label="Selecione um item" />
        {PRIVATE_ROUTES.map(({name}) => {
          return <Picker.Item value={name} key={name} label={name} />;
        })}
      </StyledPicker>
      {withCodeInput && (
        <>
          <Text italic marginTop="8px" marginBottom="4px">
            Insira o código da disciplina
          </Text>
          <TextInput
            onChangeText={setSubjectCode}
            placeholder="Ex.: IME-01388"
          />
        </>
      )}
      <NextBtn
        size="small"
        fullWidth
        onPress={handleOnPress}
        loading={loading}
        disabled={!page}>
        Próximo
      </NextBtn>
    </Container>
  );
};

export default FeatureSelectionStep;
