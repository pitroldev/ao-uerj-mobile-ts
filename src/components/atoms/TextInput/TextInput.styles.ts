import styled from 'styled-components/native';

export const InputContainer = styled.View`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  margin: 5px;
  min-height: 50px;
  max-height: 50px;
  flex-grow: 1;

  border-radius: 8px;
  background-color: ${({theme}) => theme.COLORS.BACKGROUND};
  border: 1px solid ${({theme}) => theme.COLORS.BACKGROUND_400};
  border-top-right-radius: 0;
`;

export const Input = styled.TextInput.attrs(({theme}) => ({
  placeholderTextColor: theme.COLORS.BACKGROUND_400,
}))`
  flex: 1;
  margin-left: 5px;
  font-family: ${({theme}) => theme.FONTS.REGULAR};
  color: ${({theme}) => theme.COLORS.TEXT_PRIMARY};
`;

export const IconContainer = styled.View`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-left: 8px;
  margin-right: 4px;
`;
