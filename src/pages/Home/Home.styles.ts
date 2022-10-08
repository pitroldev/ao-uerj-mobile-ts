import styled from 'styled-components/native';
import ScrollView from '@atoms/ScrollView';

export const MainContainer = styled(ScrollView)`
  padding: 0%;
  padding-top: 8%;

  border-top-left-radius: 50px;
  background-color: ${({theme}) => theme.COLORS.BACKGROUND};
`;
