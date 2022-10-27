import styled from 'styled-components/native';

import Box from '@atoms/Box';

export const Container = styled(Box).attrs({size: 'small'})`
  margin: 5px auto;
  margin-top: 8px;

  display: flex;
  align-items: center;
  justify-content: center;
`;
