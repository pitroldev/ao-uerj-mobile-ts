import styled from 'styled-components/native';

import { ProgressBar, Text } from '@components/ui';

/** Coluna "Turma" (".tt col.t"). */
const NUMBER_COLUMN = 56;
/** Recuo das células à direita do número (".tt td" padding-left 12). */
const BODY_INSET = 12;
/** Espaço entre Solicitadas e Ocupadas (".tt td+td" padding-left 20). */
const CELL_GAP = 20;

export const HeaderRow = styled.View`
  flex-direction: row;
  padding-bottom: ${({ theme }) => theme.spacing.sm}px;
  border-bottom-width: ${({ theme }) => theme.borders.hairline}px;
  border-bottom-color: ${({ theme }) => theme.colors.rule};
`;

export const HeaderNumber = styled.View`
  width: ${NUMBER_COLUMN}px;
`;

export const HeaderCell = styled.View<{ $last?: boolean }>`
  flex: 1;
  min-width: 0px;
  padding-left: ${({ $last }) => ($last ? CELL_GAP : BODY_INSET)}px;
`;

export const ClassBlock = styled.View`
  flex-direction: row;
  border-bottom-width: ${({ theme }) => theme.borders.hairline}px;
  border-bottom-color: ${({ theme }) => theme.colors.rule};
`;

export const NumberCell = styled.View`
  width: ${NUMBER_COLUMN}px;
  padding-top: ${({ theme }) => theme.spacing.md}px;
  padding-bottom: 14px;
`;

export const Body = styled.View`
  flex: 1;
  min-width: 0px;
  padding-left: ${BODY_INSET}px;
`;

export const VacancyRow = styled.View`
  flex-direction: row;
  gap: ${CELL_GAP}px;
  padding-top: ${({ theme }) => theme.spacing.md}px;
`;

export const VacancyCell = styled.View`
  flex: 1;
  min-width: 0px;
`;

/** "38/40" à esquerda e "● Crítico" à direita (".vc-top"). */
export const VacancyTop = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  column-gap: 6px;
  min-height: 22px;
`;

export const VacancyBar = styled(ProgressBar)`
  margin-top: 6px;
`;

/** Segunda linha da turma: docentes, Preferencial e horários (".tt-d"). */
export const Details = styled.View`
  gap: ${({ theme }) => theme.spacing.xxs}px;
  padding-top: 10px;
  padding-bottom: 14px;
`;

export const TeachersRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  column-gap: 10px;
  row-gap: ${({ theme }) => theme.spacing.xs}px;
`;

export const Teachers = styled(Text)`
  flex-shrink: 1;
`;
