import styled from 'styled-components/native';

export const Container = styled.View`
  height: 100%;
  width: 100%;

  padding: 0% 4%;
  padding-top: 6%;

  border-top-left-radius: 50px;
  background-color: ${({ theme }) => theme.COLORS.BACKGROUND};
`;

export const Row = styled.View`
  flex-direction: row;
  min-height: 60px;
`;

export const View = styled.View`
  flex: 1;
`;
