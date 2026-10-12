import styled from 'styled-components/native';

import { Card } from '@components/ui';

/** ".ch-legend": legenda das linhas acima do card do gráfico. */
export const Legend = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  column-gap: 16px;
  row-gap: 4px;
  margin-top: -2px;
  margin-bottom: 10px;
`;

export const LegendItem = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
`;

/** ".chart": card do gráfico com respiro próprio. */
export const ChartCard = styled(Card)`
  padding: 10px 8px 4px 8px;
`;

/** Aviso dentro da seção, antes das linhas (".notice" deixa 20 abaixo). */
export const NoticeSlot = styled.View`
  margin-bottom: 20px;
`;

/* ------------------------------------------------------------- esqueleto */

export const SkeletonStats = styled.View`
  flex-direction: row;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme }) => theme.colors.rule};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: 0px;
`;

export const SkeletonStat = styled.View<{ $first?: boolean }>`
  flex: 1;
  gap: 8px;
  padding: 14px 16px;
  border-left-width: ${({ theme, $first }) =>
    $first ? 0 : theme.borders.hairline}px;
  border-left-color: ${({ theme }) => theme.colors.rule};
`;

export const SkeletonSection = styled.View`
  margin-top: ${({ theme }) => theme.layout.sectionGap}px;
`;

export const SkeletonHeader = styled.View`
  min-height: ${({ theme }) => theme.layout.sectionHeaderMinHeight}px;
  justify-content: center;
  margin-bottom: ${({ theme }) => theme.layout.sectionHeaderGap}px;
`;
