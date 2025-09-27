import styled from 'styled-components/native';

import Box from '@atoms/Box';

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

export const Column = styled.View`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

export const VacanciesRow = styled.View`
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
`;

export const Container = styled(Box).attrs({ size: 'small' })`
  margin: 5px;
`;

export const VacancieBox = styled(Box).attrs({ size: 'small' })`
  margin: 0px 4px;
  align-items: center;
  justify-content: center;
`;
