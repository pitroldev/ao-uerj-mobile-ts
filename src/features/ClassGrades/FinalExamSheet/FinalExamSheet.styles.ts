import styled from 'styled-components/native';
import { Text } from '@components/ui';

/** Uma disciplina da simulação, com fio embaixo (".sim"). */
export const SimRow = styled.View`
  padding: ${({ theme }) => theme.spacing.md}px 0px;
  border-bottom-width: ${({ theme }) => theme.borders.hairline}px;
  border-bottom-color: ${({ theme }) => theme.colors.rule};
`;

export const SimHead = styled.View`
  flex-direction: row;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.md}px;
`;

export const SimName = styled(Text)`
  flex: 1;
`;

/** Contador e resultado lado a lado; quebram de linha com fonte grande. */
export const SimControls = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  column-gap: ${({ theme }) => theme.spacing.md}px;
  row-gap: ${({ theme }) => theme.spacing.sm}px;
  margin-top: ${({ theme }) => theme.spacing.sm}px;
`;

export const Intro = styled(Text)`
  margin-bottom: ${({ theme }) => theme.spacing.xs}px;
`;

export const Empty = styled(Text)`
  padding: ${({ theme }) => theme.spacing.md}px 0px;
`;

export const CrCard = styled.View`
  margin-top: ${({ theme }) => theme.spacing.lg}px;
`;

export const CrHead = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm}px;
`;

export const CrValues = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md}px;
  margin: ${({ theme }) => theme.spacing.xs}px 0px;
`;

export const CrDelta = styled.View`
  margin-left: auto;
`;

export const Waiting = styled(Text)`
  margin-top: ${({ theme }) => theme.spacing.md}px;
`;

export const Foot = styled.View`
  margin-top: ${({ theme }) => theme.spacing.lg}px;
`;
