import styled from 'styled-components/native';

/** Campo de código + botão quadrado de buscar (".search-row"). */
export const SearchRow = styled.View`
  flex-direction: row;
  align-items: stretch;
  gap: ${({ theme }) => theme.spacing.sm}px;
`;

export const Grow = styled.View`
  flex: 1;
  min-width: 0px;
`;
