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

  max-height: 140px;

  margin: 10px;
  margin-top: auto;
  margin-bottom: 8px;
`;

export const InputContainer = styled.ScrollView`
  padding: 4px;

  border: solid 1px;
  border-radius: 12px;
  border-color: ${({theme}) => theme.COLORS.PRIMARY};
  background-color: ${({theme}) => theme.COLORS.BACKGROUND};

  elevation: 6;
`;

export const Button = styled.TouchableOpacity`
  align-self: flex-end;
  align-items: center;
  justify-content: center;

  width: 50px;
  height: 50px;

  border-radius: 50px;
  background-color: ${({theme}) => theme.COLORS.PRIMARY};

  margin-left: 10px;

  elevation: 6;
`;

export const ScrollView = styled.ScrollView`
  padding: 8px;
`;

export const TextArea = styled.TextInput``;
