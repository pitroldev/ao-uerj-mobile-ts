import React, { useState } from 'react';
import { Picker } from '@react-native-picker/picker';
import type { ReportStepProps } from '../types';
import Text from '@atoms/Text';
import TextInput from '@atoms/TextInput';
import StyledPicker from '@atoms/Picker';
import { Container, NextBtn } from './FeatureSelectionStep.styles';

const FEATURES = [
  'Login e Sessão',
  'Quadro de Horários',
  'Gerador de Grade',
  'Meu Progresso',
  'Mural de Mensagens',
  'Quadro de Notas',
  'RID Parcial',
  'Disciplinas do Currículo',
  'Disciplinas Universais',
  'Disciplinas Realizadas',
  'Pesquisa de Disciplinas',
  'Informações de uma disciplina específica',
  'Sobre',
];

const FeatureSelectionStep = ({ body, nextStep }: ReportStepProps) => {
  const [page, setPage] = useState(body.page);
  const [subjectCode, setSubjectCode] = useState(body.subjectCode ?? '');
  const withCodeInput = page === 'Informações de uma disciplina específica';
  const validCode = /^[A-Z][A-Z0-9]{1,7}-\d{3,8}$/.test(
    subjectCode.trim().toUpperCase(),
  );
  return (
    <Container>
      <Text italic marginTop="8px" marginBottom="4px">
        Onde o erro aconteceu?
      </Text>
      <StyledPicker
        selectedValue={page}
        onValueChange={value => setPage(String(value))}
      >
        <Picker.Item value="" label="Selecione um item" />
        {FEATURES.map(name => (
          <Picker.Item value={name} key={name} label={name} />
        ))}
      </StyledPicker>
      {withCodeInput && (
        <>
          <Text italic marginTop="8px" marginBottom="4px">
            Insira o código da disciplina
          </Text>
          <TextInput
            value={subjectCode}
            onChangeText={setSubjectCode}
            placeholder="Ex.: IME02-01388"
            autoCapitalize="characters"
          />
        </>
      )}
      <NextBtn
        size="small"
        fullWidth
        disabled={!page || (withCodeInput && !validCode)}
        onPress={() =>
          nextStep({
            page,
            subjectCode: withCodeInput
              ? subjectCode.trim().toUpperCase()
              : undefined,
          })
        }
      >
        Próximo
      </NextBtn>
    </Container>
  );
};

export default FeatureSelectionStep;
