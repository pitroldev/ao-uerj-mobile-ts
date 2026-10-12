import styled from 'styled-components/native';

import { Text } from '@components/ui/Text';

/** Barra azul: 52dp abaixo da barra de status, botões de 48dp nas pontas. */
export const Container = styled.View<{ $top: number }>`
  flex-direction: row;
  align-items: center;
  padding: ${({ $top }) => $top}px 4px 0px 4px;
  min-height: ${({ theme, $top }) => theme.layout.appBarHeight + $top}px;
  background-color: ${({ theme }) => theme.colors.brand};
`;

export const TitleButton = styled.Pressable`
  flex: 1;
  min-height: ${({ theme }) => theme.sizes.touch}px;
  justify-content: center;
`;

export const Title = styled(Text)`
  text-align: center;
`;

export const LogoButton = styled.Pressable`
  width: ${({ theme }) => theme.sizes.touch}px;
  height: ${({ theme }) => theme.sizes.touch}px;
  border-radius: ${({ theme }) => theme.sizes.touch / 2}px;
  align-items: center;
  justify-content: center;
`;
