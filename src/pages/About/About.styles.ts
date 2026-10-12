import styled from 'styled-components/native';

import { Notice, Text } from '@components/ui';

/** ".about-hero": logo, nome e versão centralizados. */
export const Hero = styled.View`
  align-items: center;
  padding-top: 8px;
`;

export const AppName = styled(Text)`
  margin-top: 14px;
`;

export const Version = styled(Text)`
  margin-top: 2px;
`;

/** ".callout": aviso de app não oficial, 20 abaixo do bloco do logo. */
export const Callout = styled(Notice)`
  margin-top: 20px;
`;

/** ".dev": avatar de iniciais e nome do desenvolvedor. */
export const Developer = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 4px 0px 12px;
`;

/** ".dev-links": GitHub, LinkedIn e Email lado a lado (quebram com fonte grande). */
export const DevLinks = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
`;

/**
 * Cada link ocupa a mesma largura; a base cresce com o tamanho da fonte do
 * sistema para os botões quebrarem de linha em vez de cortar o rótulo.
 */
export const DevLink = styled.View<{ $basis: number }>`
  flex-grow: 1;
  flex-basis: ${({ $basis }) => $basis}px;
`;
