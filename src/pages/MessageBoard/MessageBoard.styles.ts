import styled from 'styled-components/native';

export const MainContainer = styled.View`
  display: flex;
  flex-direction: column;

  padding-top: 8%;
  height: 100%;

  border-top-left-radius: 50px;
  background-color: ${({ theme }) => theme.COLORS.BACKGROUND};
`;
