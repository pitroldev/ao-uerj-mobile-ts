import React from 'react';

import { TextField } from '@components/ui';

import { Description, Question } from '../ErrorReport.styles';
import type { ExplanationStepProps } from '../types';

const QUESTION = 'Descreva o que aconteceu e o resultado esperado';

/** Passo 2 do relato: a descrição livre, com a tela escolhida como contexto. */
export const ExplanationStep = ({
  page,
  subjectCode,
  description,
  onChangeDescription,
  editable = true,
}: ExplanationStepProps) => (
  <>
    <Question variant="body" weight="semibold">
      {QUESTION}
    </Question>
    <Description tone="muted">
      Tela: {page}
      {subjectCode ? ` · ${subjectCode}` : ''}
    </Description>
    <TextField
      multiline
      value={description}
      onChangeText={onChangeDescription}
      maxLength={4000}
      placeholder="Ex.: as notas da P2 não aparecem no Início."
      accessibilityLabel={QUESTION}
      editable={editable}
    />
  </>
);
