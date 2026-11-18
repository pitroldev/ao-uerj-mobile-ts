import React from 'react';

import { ListRow, Switch, TextField } from '@components/ui';

import { Description, Question } from '../ErrorReport.styles';
import type { ExplanationStepProps } from '../types';

const QUESTION = 'Descreva o que aconteceu e o resultado esperado';

/** Passo 2 do relato: a descrição livre, com a tela escolhida como contexto. */
export const ExplanationStep = ({
  page,
  subjectCode,
  withGeneratorSummary,
  pagesOffered,
  sendPages,
  onToggleSendPages,
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
    {withGeneratorSummary ? (
      <Description tone="muted">
        Junto vai um resumo da sua última tentativa no gerador, só com números:
        quantas disciplinas, turmas e horários ocupados, e o resultado.
      </Description>
    ) : null}
    <TextField
      multiline
      value={description}
      onChangeText={onChangeDescription}
      maxLength={4000}
      placeholder="Ex.: as notas da P2 não aparecem no Início."
      accessibilityLabel={QUESTION}
      editable={editable}
    />
    {pagesOffered ? (
      <ListRow
        inset={0}
        leadingIcon="description"
        title="Mandar a página do portal"
        titleWeight="regular"
        meta="Sem seu nome, matrícula, notas e textos"
        trailing={<Switch value={Boolean(sendPages)} />}
        accessibilityRole="switch"
        accessibilityState={{
          checked: Boolean(sendPages),
          disabled: !editable,
        }}
        disabled={!editable}
        onPress={onToggleSendPages}
      />
    ) : null}
  </>
);
