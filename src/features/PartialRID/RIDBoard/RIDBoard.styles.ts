import styled from 'styled-components/native';

import { Text } from '@components/ui';

/** ".rid-h": data da última atualização logo abaixo do título. */
export const UpdatedAt = styled(Text)`
  margin: -6px 0px 6px;
`;

/** ".kv": dois valores lado a lado (Solicitadas/Oferecidas e Sua posição). */
export const Values = styled.View`
  flex-direction: row;
  gap: 12px;
  margin: 6px 0px 2px;
`;

export const Value = styled.View`
  flex: 1;
  min-width: 0px;
  gap: 2px;
`;

/** ".rid-alert": situação destacada quando não há posição na fila. */
export const Alert = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: ${({ theme }) => theme.radii.md}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme }) => theme.status.bad.wash};
`;

export const AlertText = styled(Text)`
  flex: 1;
`;
