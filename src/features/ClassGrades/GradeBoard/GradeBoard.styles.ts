import styled from 'styled-components/native';

import Box from '@atoms/Box';

export const Container = styled.View`
  margin: 4px 10px;
`;

export const Row = styled.View`
  flex-direction: row;
  width: 100%;
  justify-content: space-between;
`;

export const NotasRow = styled.View`
  flex-direction: row;
  width: 100%;
  margin-top: 6px;
  justify-content: space-around;
`;

export const Column = styled.View`
  flex: 1;
`;

export const BoxContainer = styled(Box)`
  flex-direction: column;
  align-items: space-between;
  padding: 8px;
  margin: 6px 4px;
`;

export const MiniBox = styled(Box)`
  padding: 5px;
  margin: 2px;
  min-width: 50px;
`;
