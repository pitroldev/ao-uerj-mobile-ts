import styled from 'styled-components/native';

export const Container = styled.ScrollView`
  display: flex;
  flex-direction: column;

  padding: 0 16px;
`;

export const SubjectsColumn = styled.View`
  display: flex;
  flex-direction: column;

  margin: 4px;

  border-radius: 8px;
  padding: 8px;
  background-color: ${({theme}) => theme.COLORS.BACKGROUND};
  elevation: 4;
`;

export const SubjectsRow = styled.View`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;

  justify-content: space-between;
`;

export const TeacherColumn = styled.View`
  display: flex;
  flex-direction: column;
  margin-left: 12px;
`;

export const InfoRow = styled.View`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;

  padding: 4px;
`;

export const InfoContainer = styled.View`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  border-radius: 8px;
  padding: 8px;
  background-color: ${({theme}) => theme.COLORS.BACKGROUND};
  elevation: 4;
`;
