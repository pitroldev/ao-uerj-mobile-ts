import styled from 'styled-components/native';

import { Text } from '@components/ui';

/** ".splash": tela azul inteira com o logo no centro, texto e barra abaixo. */
export const MainContainer = styled.View`
  flex: 1;
  align-items: center;
  padding: 0px 48px;
  background-color: ${({ theme }) => theme.colors.brand};
`;

/** Mesma altura que `Below`: o logo fica no centro, como no splash nativo. */
export const Spacer = styled.View`
  flex: 1;
`;

export const Below = styled.View`
  flex: 1;
  align-items: center;
  gap: 22px;
  padding-top: 22px;
`;

/** "max-width: 28ch" do protótipo. */
export const Message = styled(Text)`
  max-width: 244px;
`;
