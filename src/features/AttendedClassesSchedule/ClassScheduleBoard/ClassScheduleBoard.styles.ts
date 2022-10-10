import styled from 'styled-components/native';
import Box from '@root/components/atoms/Box';

export const CarouselContainer = styled.View`
  margin: 12px 0;
`;

export const WeekDayContainer = styled.View`
  background-color: ${({theme}) => theme.COLORS.BACKGROUND};
  width: 90%;

  border-radius: 12px;
  padding: 12px 16px 4px 16px;

  margin-left: 12px;
  margin-top: 12px;
  elevation: 8;
`;

export const ClassBox = styled(Box)`
  margin-bottom: 12px;
  elevation: 4;

  height: 60px;
`;

export const Row = styled.View`
  display: flex;
  flex-direction: row;

  align-items: center;
  align-content: center;
  justify-content: center;
`;

export const TimeInfoColumn = styled.View`
  flex: 1;
  display: flex;
  flex-direction: column;

  align-items: center;
  align-content: center;
  justify-content: center;
`;

export const SubjectInfoColumn = styled.View`
  flex: 2;
  display: flex;

  align-items: center;
  align-content: center;
  justify-content: center;
`;
