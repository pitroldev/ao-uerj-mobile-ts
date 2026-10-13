import React from 'react';
import styled from 'styled-components/native';

import { List, ListRow, Radio, TextField } from '@components/ui';

import { Question } from '../ErrorReport.styles';
import { FEATURES, SUBJECT_PAGE } from '../reportPages';
import type { FeatureStepProps } from '../types';

/** Campo do código logo abaixo da opção tocada (a lista sangra até as bordas). */
const CodeField = styled.View`
  padding: 4px ${({ theme }) => theme.layout.gutter}px 12px;
`;

const QUESTION = 'Onde o erro aconteceu?';

/** Passo 1 do relato: a tela do problema, como uma lista de rádios. */
export const FeatureSelectionStep = ({
  page,
  subjectCode,
  onChangePage,
  onChangeSubjectCode,
}: FeatureStepProps) => (
  <>
    <Question variant="body" weight="semibold">
      {QUESTION}
    </Question>
    <List accessibilityRole="radiogroup" accessibilityLabel={QUESTION}>
      {FEATURES.flatMap(name => {
        const checked = page === name;
        const row = (
          <ListRow
            key={name}
            title={name}
            titleWeight="regular"
            leading={<Radio selected={checked} />}
            onPress={() => onChangePage(name)}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
          />
        );
        if (name !== SUBJECT_PAGE || !checked) return [row];
        return [
          row,
          <CodeField key="subject-code">
            <TextField
              label="Insira o código da disciplina"
              value={subjectCode}
              onChangeText={onChangeSubjectCode}
              placeholder="Ex.: IME02-01388"
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </CodeField>,
        ];
      })}
    </List>
  </>
);
