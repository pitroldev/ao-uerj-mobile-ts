import styled from 'styled-components/native';

import SVG from '@assets/AO_Logo.svg';

export const LogoAO = styled(SVG)`
  align-self: center;
`;

export const AOButton = styled.TouchableOpacity`
  align-self: flex-end;
  align-items: center;
  justify-content: center;
  height: 60px;
  width: 15%;
`;

export const MenuButton = styled.TouchableOpacity`
  align-self: flex-start;
  align-items: center;
  justify-content: center;
  height: 60px;
  width: 15%;
`;

export const Container = styled.View`
  flex-direction: row;
  justify-content: space-between;
  background-color: ${({ theme }) => theme.COLORS.PRIMARY};
  min-height: 60px;
`;

export const Button = styled.TouchableOpacity`
  height: 60px;
  width: 70%;
  align-self: center;
  justify-content: center;
`;
