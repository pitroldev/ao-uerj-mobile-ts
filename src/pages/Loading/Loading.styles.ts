import styled from 'styled-components/native';

import { Text } from '@components/ui';

/** ".splash": tela azul inteira com logo, texto e barra, um pouco acima do centro. */
export const MainContainer = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 22px;
  padding: 0px 48px 80px 48px;
  background-color: ${({ theme }) => theme.colors.brand};
`;

/** "max-width: 28ch" do protótipo. */
export const Message = styled(Text)`
  max-width: 244px;
`;
