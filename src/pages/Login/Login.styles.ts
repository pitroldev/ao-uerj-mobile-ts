import styled from 'styled-components/native';

import Button from '@atoms/Button';
import SVG from '@root/assets/AO_Logo.svg';

export const LogoContainer = styled.KeyboardAvoidingView`
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  height: 100%;

  background-color: ${({theme}) => theme.COLORS.PRIMARY};
`;

export const LogoUERJ = styled(SVG)`
  top: 8%;
  height: 40%;
  width: 40%;

  align-self: center;
`;

export const Container = styled.View`
  display: flex;
  height: 78%;

  padding: 0% 5%;
  padding-top: 10%;

  border-top-left-radius: 50px;
  background-color: ${({theme}) => theme.COLORS.BACKGROUND};
`;

export const SignInButton = styled(Button)`
  margin-top: 8%;
  align-self: center;
  width: 99%;
`;

export const RecoveryPassButton = styled.TouchableOpacity`
  padding: 4%;
  margin-top: 5%;
  margin-bottom: 5%;
`;
