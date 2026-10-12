import styled from 'styled-components/native';

/** ".dayview": 18 abaixo do seletor de dias. */
export const DayView = styled.View`
  margin-top: 18px;
`;

/** ".dv-head": data do dia, "Hoje" e a contagem de aulas à direita. */
export const DayHead = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
`;

export const DayCount = styled.View`
  margin-left: auto;
`;
