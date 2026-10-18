import styled from 'styled-components/native';

export const SummaryHead = styled.View`
  flex-direction: row;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md}px;
  margin-bottom: ${({ theme }) => theme.spacing.sm}px;
`;

export const SummaryStatus = styled.View`
  margin-top: ${({ theme }) => theme.spacing.sm}px;
`;

/** Carga horária e presença mínima lado a lado (".kv"). */
export const Facts = styled.View`
  flex-direction: row;
  gap: ${({ theme }) => theme.spacing.md}px;
  margin-top: ${({ theme }) => theme.spacing.md}px;
`;

export const Fact = styled.View`
  flex: 1;
  gap: ${({ theme }) => theme.spacing.xxs}px;
`;

export const Question = styled.View`
  gap: ${({ theme }) => theme.spacing.sm}px;
`;

export const Spaced = styled.View`
  margin-top: ${({ theme }) => theme.spacing.lg}px;
`;

export const Foot = styled.View`
  margin-top: ${({ theme }) => theme.spacing.xl}px;
  gap: ${({ theme }) => theme.spacing.md}px;
`;
