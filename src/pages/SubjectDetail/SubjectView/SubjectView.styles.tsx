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
  flex-direction: row;
  width: 100%;
  justify-content: space-around;
  margin-bottom: 4px;

  flex-wrap: wrap;
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
  margin: 5px;
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
`;
