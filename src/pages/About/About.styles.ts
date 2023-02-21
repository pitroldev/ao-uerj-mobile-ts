import styled from 'styled-components/native';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome';

import CardapioSVG from '@assets/CardapioMobile_Logo.svg';
import AOUerjSVG from '@assets/AO_Logo.svg';

export const MainContainer = styled.ScrollView`
  display: flex;
  flex-direction: column;

  padding: 0%;
  padding-top: 8%;
  height: 100%;

  border-top-left-radius: 50px;
  background-color: ${({theme}) => theme.COLORS.BACKGROUND};
`;

export const Row = styled.View`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  margin: 16px 48px;
`;

export const Column = styled.View`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  margin: 8px 16px;
`;

export const AOLogoContainer = styled.View`
  height: 100px;
  width: 100px;
  border-radius: 50px;

  padding: 16px;
  margin: 8px auto;
  background-color: ${({theme}) => theme.COLORS.PRIMARY};
`;

export const AOUerjLogo = styled(AOUerjSVG)`
  align-self: center;
`;

export const CardapioMobileLogo = styled(CardapioSVG)`
  align-self: center;
`;

export const Icon = styled(FontAwesomeIcon).attrs(({theme}) => ({
  color: theme.COLORS.BACKGROUND,
  size: 20,
}))``;
