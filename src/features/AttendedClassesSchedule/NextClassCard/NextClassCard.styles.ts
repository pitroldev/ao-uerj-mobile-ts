import styled from 'styled-components/native';

import { Tag, Text } from '@components/ui';

/** ".next": padding 14 8 14 16, horário à esquerda e fio vertical. */
export const Row = styled.View`
  flex-direction: row;
  align-items: stretch;
  padding: 14px 8px 14px 16px;
`;

/** ".next-time": coluna do horário (80 de largura mínima). */
export const TimeColumn = styled.View`
  min-width: 80px;
  padding-right: 14px;
`;

export const Until = styled(Text)`
  margin-top: 2px;
`;

/** ".next-main": fio vertical de 1px à esquerda. */
export const Main = styled.View`
  flex: 1;
  min-width: 0px;
  gap: 2px;
  padding: 2px 0px 0px 14px;
  border-left-width: ${({ theme }) => theme.borders.hairline}px;
  border-left-color: ${({ theme }) => theme.colors.rule};
`;

/** ".next-row": turno com ponto + tempos e sala. */
export const MetaRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 10px;
  row-gap: 2px;
  margin-top: 2px;
`;

/** "P2 nesta aula", abaixo da sala. */
export const ExamTag = styled(Tag)`
  margin-top: 6px;
`;

export const Chevron = styled.View`
  align-self: center;
  margin-left: 4px;
`;
