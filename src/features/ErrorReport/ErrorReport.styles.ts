import styled from 'styled-components/native';

import { Text } from '@components/ui';

/** ".sheet-q": pergunta do passo (15 semibold). */
export const Question = styled(Text)`
  margin: 4px 0px 8px;
`;

/** ".sheet-desc": contexto secundário abaixo da pergunta. */
export const Description = styled(Text)`
  margin-bottom: 8px;
`;
