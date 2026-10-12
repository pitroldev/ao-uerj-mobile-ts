import { Animated } from 'react-native';
import styled from 'styled-components/native';

import { Text } from '@components/ui';

export const Container = styled.View<{ $bottom: number }>`
  flex: 1;
  padding: 4px 0px ${({ $bottom }) => $bottom}px 0px;
  background-color: ${({ theme }) => theme.colors.brand};
`;

/** Bloco do aluno (".dr-user"). */
export const User = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 20px 16px 24px;
`;

export const UserText = styled.View`
  flex: 1;
  min-width: 0px;
`;

/** Navegação rolável com fio superior (".dr-nav"). */
export const Nav = styled.ScrollView`
  flex: 1;
  margin: 0px 12px;
  border-top-width: ${({ theme }) => theme.borders.hairline}px;
  border-top-color: ${({ theme }) => theme.colors.brandRule};
`;

export const GroupLabel = styled(Text)`
  padding: 16px 12px 6px 12px;
`;

export const Separator = styled.View`
  height: ${({ theme }) => theme.borders.hairline}px;
  margin: 12px 0px;
  background-color: ${({ theme }) => theme.colors.brandRule};
`;

/**
 * Item do menu: no mínimo 48dp, canto cortado como o destaque. Com fonte
 * grande o rótulo quebra em duas linhas e o item cresce (padding vertical).
 */
export const Item = styled.Pressable<{ $auto?: boolean }>`
  flex-direction: row;
  align-items: center;
  gap: 14px;
  min-height: ${({ theme }) => theme.sizes.touch}px;
  padding: 8px ${({ $auto }) => ($auto ? 16 : 12)}px 8px 12px;
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: 0px;
  ${({ $auto }) => ($auto ? '' : 'width: 100%;')}
  z-index: 1;
`;

export const ItemLabel = styled(Text)`
  flex-shrink: 1;
`;

/**
 * Destaque que desliza até o item ativo (".dr-hl"). A altura acompanha a do
 * item (48 ou mais, quando o rótulo quebra com fonte grande).
 */
export const Highlight = styled(Animated.View)<{ $height: number }>`
  position: absolute;
  left: 0px;
  right: 0px;
  top: 0px;
  height: ${({ $height }) => $height}px;
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme }) => theme.colors.brandHighlight};
`;

/** Rodapé com "Sair" e a versão (".dr-foot"). */
export const Footer = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 4px;
  margin: 8px 12px 0px 12px;
  padding-top: 8px;
  border-top-width: ${({ theme }) => theme.borders.hairline}px;
  border-top-color: ${({ theme }) => theme.colors.brandRule};
`;

export const Version = styled(Text)`
  flex: 1;
  padding-right: 12px;
`;
