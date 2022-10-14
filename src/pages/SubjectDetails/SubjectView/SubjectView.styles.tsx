import styled from 'styled-components/native';
import {TouchableOpacity} from 'react-native-gesture-handler';

import Box from '@atoms/Box';

export const Container = styled.View`
  height: 100%;
  width: 100%;

  padding: 0% 4%;
  padding-top: 6%;

  border-top-left-radius: 50px;
  background-color: ${({theme}) => theme.COLORS.BACKGROUND};
`;

export const TransparentButton = styled(TouchableOpacity)``;

export const InfoBox = styled(Box).attrs({size: 'small'})`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;

  margin: 5px;
`;

export const InlineRow = styled.View`
  display: flex;
  flex-direction: row;
  width: 100%;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;

  flex-wrap: wrap;
`;

export const Row = styled.View`
  display: flex;
  flex-direction: row;
  width: 100%;

  justify-content: space-between;
  margin-bottom: 5px;
`;

export const VacanciesRow = styled.View`
  display: flex;
  flex-direction: row;

  justify-content: flex-end;
`;

export const Column = styled.View`
  display: flex;
  flex-direction: column;

  width: 50%;
`;

export const ClassBox = styled(Box).attrs({size: 'small'})`
  margin: 5px;
`;

export const VacancieBox = styled(Box).attrs({size: 'small'})`
  margin: 5px;
  align-items: center;
  justify-content: center;
`;

export const ScheduleBox = styled(Box).attrs({size: 'small'})`
  margin: 5px auto;
  margin-top: 8px;

  display: flex;
  align-items: center;
  justify-content: center;
`;
