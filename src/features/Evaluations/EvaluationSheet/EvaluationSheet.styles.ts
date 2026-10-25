import styled from 'styled-components/native';

import { Text } from '@components/ui';

/** Um campo da folha: rótulo e controle, 20 abaixo do anterior. */
export const Field = styled.View`
  margin-top: ${({ theme }) => theme.spacing.xl}px;
`;

/** O primeiro campo cola no título da folha. */
export const FirstField = styled.View`
  margin-top: ${({ theme }) => theme.spacing.xs}px;
`;

/** Rótulo de um grupo de chips, como o dos campos (13/18 medium). */
export const FieldLabel = styled(Text)`
  margin-bottom: ${({ theme }) => theme.spacing.sm}px;
`;

/** Espaço entre um controle e o que ele abre (calendário, horários, lista). */
export const Below = styled.View`
  margin-top: ${({ theme }) => theme.spacing.md}px;
`;

/** Dois campos lado a lado (horários dos lembretes). */
export const Pair = styled.View`
  flex-direction: row;
  gap: ${({ theme }) => theme.spacing.md}px;
  margin-top: ${({ theme }) => theme.spacing.md}px;
`;

export const Half = styled.View`
  flex: 1;
`;

/** O horário da avaliação ocupa metade da largura, como no protótipo. */
export const TimeSlot = styled.View`
  width: 50%;
  padding-right: ${({ theme }) => theme.spacing.sm - 2}px;
`;

/** Quando cada lembrete chega: lista de fios dentro de uma caixa suave. */
export const Plan = styled.View`
  margin-top: ${({ theme }) => theme.spacing.md}px;
  padding: ${({ theme }) => theme.spacing.xs}px 14px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme }) => theme.colors.rule};
  border-radius: ${({ theme }) => theme.radii.lg}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme }) => theme.colors.surfaceMuted};
`;

export const PlanRow = styled.View<{ $divider: boolean }>`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 8px 0px;
  border-bottom-width: ${({ theme, $divider }) =>
    $divider ? theme.borders.hairline : 0}px;
  border-bottom-color: ${({ theme }) => theme.colors.rule};
`;

export const PlanWhen = styled(Text)`
  flex: 1;
`;

export const Notes = styled.View`
  gap: ${({ theme }) => theme.spacing.md}px;
  margin-top: ${({ theme }) => theme.spacing.md}px;
`;
