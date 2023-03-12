import styled from 'styled-components/native';

export const Container = styled.View``;

export const Column = styled.View`
  display: flex;
  flex-direction: column;
`;

export const Row = styled.View`
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  flex-wrap: wrap;

  margin-top: 12px;
`;
