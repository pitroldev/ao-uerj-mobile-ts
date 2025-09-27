import styled from 'styled-components/native';

import Box from '@atoms/Box';

export const CarouselContainer = styled.View``;

export const WeekDayContainer = styled.View`
  background-color: ${({ theme }) => theme.COLORS.BACKGROUND};
  width: 90%;

  border-radius: 12px;
  padding: 8px 12px 4px 12px;

  margin-left: 12px;
  margin-top: 12px;
  elevation: 8;
`;

export const ClassBox = styled(Box)`
  margin-bottom: 8px;
  elevation: 2;

  padding: 8px;
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
