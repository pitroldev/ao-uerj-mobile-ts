import React from 'react';
import styled from 'styled-components/native';

import { Text } from '@components/ui';

const STEPS = [
  'Verifique se o aplicativo está atualizado',
  'Saia e entre novamente no aplicativo',
  'Tente novamente mais tarde',
];

const Root = styled.View`
  margin-top: ${({ theme }) => theme.layout.sectionGap}px;
`;

const Title = styled(Text)`
  line-height: 22px;
`;

const Steps = styled.View`
  margin-top: 8px;
`;

const Step = styled.View`
  flex-direction: row;
`;

/** Número pendurado na margem de 20, como na lista ordenada. */
const StepNumber = styled(Text)`
  min-width: 20px;
  padding-right: 5px;
  line-height: 22px;
`;

const StepText = styled(Text)`
  flex: 1;
  line-height: 22px;
`;

const Note = styled(Text)`
  margin-top: 10px;
  line-height: 19px;
`;

/** Ajuda "Caso o erro persista", abaixo do erro do Início. */
const HomeHelp = () => (
  <Root>
    <Title variant="body" weight="semibold" accessibilityRole="header">
      Caso o erro persista
    </Title>
    <Steps>
      {STEPS.map((step, i) => (
        <Step key={step} accessible accessibilityLabel={`${i + 1}. ${step}`}>
          <StepNumber tabular align="right">
            {i + 1}.
          </StepNumber>
          <StepText>{step}</StepText>
        </Step>
      ))}
    </Steps>
    <Note variant="meta" tone="muted">
      Às vezes a UERJ atualiza o sistema e isso pode causar problemas no
      aplicativo. Normalmente esses problemas são resolvidos em pouco tempo, mas
      caso continue vendo essa mensagem contate-nos pela página Sobre.
    </Note>
  </Root>
);

export default HomeHelp;
