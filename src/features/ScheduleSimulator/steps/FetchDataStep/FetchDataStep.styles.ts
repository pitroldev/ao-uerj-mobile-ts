import styled from 'styled-components/native';

export const Container = styled.View`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

export const ContentContainer = styled.View`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

export const ButtonsRow = styled.View`
  display: flex;
  flex-direction: row;
  justify-content: space-between;

  padding-bottom: 8px;
`;

export const InfoRow = styled.View`
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;

  margin-top: 12px;
`;

export const Column = styled.View`
  display: flex;
  flex-direction: column;
`;

export const ScrollView = styled.ScrollView`
  display: flex;
  flex-direction: column;
  flex: 1;

  margin-bottom: 8px;
`;
