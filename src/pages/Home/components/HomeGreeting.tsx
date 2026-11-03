import React from 'react';
import styled from 'styled-components/native';

import { Text } from '@components/ui';

type Props = {
  /** Primeiro nome do aluno (vazio mostra só "Olá"). */
  firstName: string;
  /** "Terça, 13 de outubro". */
  date: string;
  /** `full`: "Olá" e a data; `date`: só a data (Personalizar o Início). */
  style?: 'full' | 'date';
};

const DateText = styled(Text)`
  margin-top: 2px;
`;

/** ".greet": "Olá, Marina" (24/30) e a data de hoje. */
export const HomeGreeting = ({ firstName, date, style = 'full' }: Props) =>
  style === 'date' ? (
    <Text variant="headline" accessibilityRole="header">
      {date}
    </Text>
  ) : (
    <>
      <Text variant="titleXL" accessibilityRole="header">
        {firstName ? `Olá, ${firstName}` : 'Olá'}
      </Text>
      <DateText tone="muted">{date}</DateText>
    </>
  );
