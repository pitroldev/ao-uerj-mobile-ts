import styled from 'styled-components/native';

import { Button, Text } from '@components/ui';

/** Fundo azul atrás de tudo (o painel claro sobe por cima dele). */
export const Root = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.brand};
`;

/** ".login-top": faixa azul de 220 com o logo grande centralizado. */
export const Top = styled.View<{ $inset: number }>`
  height: ${({ $inset }) => 220 + $inset}px;
  padding-top: ${({ $inset }) => $inset}px;
  align-items: center;
  justify-content: center;
`;

/** ".login-panel": o painel de conteúdo, com o canto superior esquerdo de 48. */
export const Panel = styled.View<{ $inset: number }>`
  flex-grow: 1;
  padding: 36px 24px ${({ $inset }) => 28 + $inset}px 24px;
  border-top-left-radius: ${({ theme }) => theme.layout.panelRadius}px;
  background-color: ${({ theme }) => theme.colors.background};
`;

export const Subtitle = styled(Text)`
  margin-top: 4px;
  margin-bottom: 24px;
`;

export const RecoveryButton = styled(Button)`
  margin-top: 8px;
`;

/** ".login-foot": rodapé preso ao fim do painel. */
export const Footer = styled(Text)`
  margin-top: auto;
  padding-top: 16px;
`;
