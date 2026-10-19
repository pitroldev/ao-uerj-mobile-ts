import styled from 'styled-components/native';

import { List } from '@components/ui';

export const Block = styled.View`
  margin-top: ${({ theme }) => theme.spacing.md}px;
`;

export const Row = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm}px;
`;

export const RowStart = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm}px;
`;

/** Números lado a lado no fim de um card (".kv"). */
export const Facts = styled.View`
  flex-direction: row;
  gap: ${({ theme }) => theme.spacing.md}px;
  margin-top: ${({ theme }) => theme.spacing.md}px;
`;

export const Fact = styled.View`
  flex: 1;
  gap: ${({ theme }) => theme.spacing.xxs}px;
`;

export const Bar = styled.View`
  margin: ${({ theme }) => theme.spacing.md}px 0px
    ${({ theme }) => theme.spacing.xs}px;
`;

export const Status = styled.View`
  margin-top: ${({ theme }) => theme.spacing.sm}px;
`;

/**
 * As disciplinas dentro do card do período: o respiro da última linha (12)
 * já faz o fim do card, como o topo.
 */
export const PeriodList = styled(List)`
  margin-bottom: -${({ theme }) => theme.spacing.md}px;
`;

export const PeriodCard = styled.View`
  margin-bottom: ${({ theme }) => theme.spacing.md}px;
`;

export const Foot = styled.View`
  margin-top: ${({ theme }) => theme.spacing.lg}px;
  gap: ${({ theme }) => theme.spacing.md}px;
  align-items: flex-start;
`;
