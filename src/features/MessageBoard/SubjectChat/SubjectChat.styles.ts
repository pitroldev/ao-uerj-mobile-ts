import styled from 'styled-components/native';

export const Row = styled.View`
  display: flex;
  flex-direction: row;

  justify-content: space-between;
  margin: 0px 16px;
  margin-bottom: 8px;
`;

export const InputRow = styled.View`
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  align-items: flex-end;

  max-height: 140px;

  margin: 10px;
  margin-top: auto;
  margin-bottom: 8px;
`;

export const ScrollView = styled.ScrollView`
  padding: 8px;
`;
