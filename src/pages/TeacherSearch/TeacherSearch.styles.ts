import type { ViewStyle } from 'react-native';
import styled from 'styled-components/native';

import { usePanelContentStyle } from '@templates/ScreenPanel';

/** Busca fixa no topo do painel (32 abaixo da curva, 20 nas laterais). */
export const SearchArea = styled.View`
  padding: ${({ theme }) => theme.layout.panelPaddingTop}px
    ${({ theme }) => theme.layout.gutter}px ${({ theme }) => theme.spacing.sm}px;
`;

/** Estados (carregando, vazio, erro) com as margens laterais do painel. */
export const StateArea = styled.View`
  padding: 0px ${({ theme }) => theme.layout.gutter}px;
`;

/**
 * Conteúdo da lista de professores: as linhas (`ListRow`) já têm 20 de recuo
 * e sangram até as bordas, então a lista só leva o respiro do fim do painel.
 */
export function useListContentStyle(): ViewStyle {
  const { paddingBottom } = usePanelContentStyle();
  return { paddingBottom };
}
