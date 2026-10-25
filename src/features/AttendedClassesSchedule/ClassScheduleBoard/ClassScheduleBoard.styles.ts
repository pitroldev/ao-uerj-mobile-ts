import styled from 'styled-components/native';

/** ".dayview": 18 abaixo do seletor de dias. */
export const DayView = styled.View`
  margin-top: 18px;
`;

/** ".dv-head": data do dia e a contagem; "Avaliação" à direita. */
export const DayHead = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
`;

export const DayTitle = styled.View`
  flex: 1;
  min-width: 0px;
`;

/** A data e o "Hoje" na mesma linha. */
export const DayLine = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
`;

/** O botão de texto encosta na borda, como a ação de uma seção. */
export const DayAction = styled.View`
  margin-right: -12px;
`;

/** As avaliações do dia, acima da régua de horas. */
export const DayNotice = styled.View`
  margin-bottom: ${({ theme }) => theme.spacing.sm}px;
`;
