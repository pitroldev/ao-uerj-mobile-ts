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

export const TooManyErrorsView = styled.View`
  margin: 0 16px;
  padding: 8px;
  border-radius: 8px;
  background-color: ${({theme}) => theme.COLORS.ERROR};
`;

export const TooManyErrorsWarning = styled.Text`
  font-size: 14px;
  font-weight: 600;
  color: ${({theme}) => theme.COLORS.BACKGROUND};
`;

export const TooManyErrorsBulletItem = styled.Text`
  font-size: 14px;
  color: ${({theme}) => theme.COLORS.BACKGROUND};
`;

export const TooManyErrorsBulletDescription = styled.Text`
  font-size: 12px;
  margin-top: 8px;
  color: ${({theme}) => theme.COLORS.BACKGROUND};
`;
