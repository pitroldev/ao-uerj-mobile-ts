import styled from 'styled-components/native';
import ScrollView from '@atoms/ScrollView';

export const MainContainer = styled.View`
  display: flex;
  flex-direction: column;

  padding: 0%;
  padding-top: 8%;
  height: 100%;

  border-top-left-radius: 50px;
  background-color: ${({theme}) => theme.COLORS.BACKGROUND};
`;

export const ScrollContainer = styled(ScrollView)``;

export const Row = styled.View`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  margin: 0 16px;
  margin-bottom: 4px;
`;

export const Column = styled.View`
  display: flex;
  flex-direction: column;
`;
