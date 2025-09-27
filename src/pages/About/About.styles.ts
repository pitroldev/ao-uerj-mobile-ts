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
  background-color: ${({ theme }) => theme.COLORS.BACKGROUND};
`;

export const Row = styled.View`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  margin: 0px 8px;
`;

export const Column = styled.View`
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  margin: 8px 16px;
`;

export const AOLogoContainer = styled.View`
  height: 100px;
  width: 100px;
  border-radius: 50px;

  padding: 16px;
  margin: 4px auto;
  background-color: ${({ theme }) => theme.COLORS.PRIMARY};
`;

export const AOUerjLogo = styled(AOUerjSVG)`
  align-self: center;
`;

export const CardapioMobileLogo = styled(CardapioSVG)`
  align-self: center;
`;

export const Icon = styled(FontAwesomeIcon as any).attrs(({ theme }) => ({
  color: theme.COLORS.BACKGROUND,
  size: 20,
}))``;

export const ButtonIcon = styled(FontAwesomeIcon as any).attrs(({ theme }) => ({
  color: theme.COLORS.PRIMARY,
  size: 16,
}))`
  margin-right: 8px;
`;

export const ButtonContent = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: center;
`;

export const SectionContainer = styled.View`
  margin: 0;
  padding: 0 12px;
  align-items: center;
`;

export const ActionButton = styled.TouchableOpacity`
  border: 1px solid ${({ theme }) => theme.COLORS.PRIMARY}20;
  border-radius: 8px;
  padding: 8px 16px;
  margin: 6px;
  min-width: 160px;
  align-items: center;
`;

export const Divider = styled.View`
  margin: 16px;
`;
