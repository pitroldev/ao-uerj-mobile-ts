import React from 'react';
import styled from 'styled-components/native';

import { Text } from '@components/ui';

type Props = {
  /** Primeiro nome do aluno (vazio mostra só "Olá"). */
  firstName: string;
  /** "Terça, 13 de outubro". */
  date: string;
};

const DateText = styled(Text)`
  margin-top: 2px;
`;

/** ".greet": "Olá, Marina" (24/30) e a data de hoje. */
const HomeGreeting = ({ firstName, date }: Props) => (
  <>
    <Text variant="titleXL" accessibilityRole="header">
      {firstName ? `Olá, ${firstName}` : 'Olá'}
    </Text>
    <DateText tone="muted">{date}</DateText>
  </>
);

export default HomeGreeting;
