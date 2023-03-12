import styled from 'styled-components/native';

import Box from '@atoms/Box';

export const Container = styled(Box)`
  width: 100%;
  align-items: stretch;
`;

export const ScrollView = styled.ScrollView`
  width: 100%;
`;

export const FeatureContainer = styled.View`
  display: flex;
  flex-direction: column;

  margin-bottom: 12px;
`;

export const Row = styled.View`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`;
