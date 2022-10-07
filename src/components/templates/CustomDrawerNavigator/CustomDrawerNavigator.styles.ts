import styled from 'styled-components/native';

export const Container = styled.View`
  height: 100%;
  padding-top: 21%;
  padding-bottom: 7%;
  background-color: ${props => props.theme.COLORS.PRIMARY};
`;

export const Text = styled.Text`
  font-size: 18px;
  font-family: ${props => props.theme.FONTS.LIGHT};
  color: ${props => props.theme.COLORS.BACKGROUND};
`;

export const Button = styled.TouchableOpacity`
  padding-top: 3%;
  padding-bottom: 3%;
  padding-right: 7%;
  padding-left: 7%;
`;

export const ButtonLogout = styled(Button)`
  margin-top: auto;
`;

export const ScrollView = styled.ScrollView``;
