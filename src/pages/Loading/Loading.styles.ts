import styled from 'styled-components/native';

export const MainContainer = styled.View`
  display: flex;
  flex-direction: column;
  justify-content: start;
  align-items: center;

  padding: 32px;
  height: 100%;

  border-top-left-radius: 50px;
  background-color: ${({theme}) => theme.COLORS.BACKGROUND};
`;
