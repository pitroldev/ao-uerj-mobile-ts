import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled from 'styled-components/native';

import { IconButton, Text } from '@components/ui';
import { formatTenth, stepGrade } from '../finalExamText';

type Props = {
  value: number;
  onChange: (value: number) => void;
  /** "PF de Cálculo II": rótulo do valor e dos botões. */
  label: string;
  style?: StyleProp<ViewStyle>;
};

const Root = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm}px;
`;

/** A caixa do número do contador (".stepper-f"), só para leitura. */
const ValueBox = styled.View`
  width: 64px;
  min-height: ${({ theme }) => theme.sizes.field}px;
  align-items: center;
  justify-content: center;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme }) => theme.colors.fieldBorder};
  border-radius: ${({ theme }) => theme.radii.lg}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme }) => theme.colors.surface};
`;

/** − nota + da simulação, de 0,5 em 0,5, entre 0 e 10. */
export function GradeStepper({ value, onChange, label, style }: Props) {
  const text = formatTenth(value);
  return (
    <Root style={style}>
      <IconButton
        icon="remove"
        variant="outlined"
        accessibilityLabel={`Diminuir ${label}`}
        disabled={value <= 0}
        onPress={() => onChange(stepGrade(value, -1))}
      />
      <ValueBox
        accessible
        accessibilityLabel={`${label}: ${text}`}
        accessibilityLiveRegion="polite"
      >
        <Text variant="titleS" tabular>
          {text}
        </Text>
      </ValueBox>
      <IconButton
        icon="add"
        variant="outlined"
        accessibilityLabel={`Aumentar ${label}`}
        disabled={value >= 10}
        onPress={() => onChange(stepGrade(value, 1))}
      />
    </Root>
  );
}
