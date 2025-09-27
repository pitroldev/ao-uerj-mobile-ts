import styled from 'styled-components/native';

export const Container = styled.View`
  height: 100%;
  width: 100%;

  padding: 0% 4%;
  padding-top: 6%;

  border-top-left-radius: 50px;
  background-color: ${({ theme }) => theme.COLORS.BACKGROUND};
`;

export const StatCard = styled.View`
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  background-color: ${({ theme }) => theme.COLORS.BACKGROUND ?? '#fff'};

  border-width: 1px;
  border-color: ${({ theme }) => theme.COLORS.BACKGROUND_500 ?? '#DDD'};
`;

export const StatTitle = styled.Text`
  font-size: 14px;
  color: ${({ theme }) => theme.COLORS.TEXT_PRIMARY ?? '#333'};
`;

export const StatValue = styled.Text`
  font-size: 22px;
  font-weight: 700;
  margin-top: 4px;
  color: ${({ theme }) => theme.COLORS.TEXT_PRIMARY ?? '#000'};
`;

export const SectionTitle = styled.Text`
  font-size: 16px;
  font-weight: 600;
  margin: 12px 0 8px 0;
  color: ${({ theme }) => theme.COLORS.TEXT_PRIMARY ?? '#000'};
`;

export const Row = styled.View`
  flex-direction: row;
  gap: 12px;
`;

export const Col = styled.View`
  flex: 1;
`;

export const ProgressContainer = styled.View`
  margin-top: 8px;
`;

export const ProgressTrack = styled.View`
  height: 10px;
  border-radius: 6px;
  background-color: ${({ theme }) => theme.COLORS.BACKGROUND_500};
  overflow: hidden;
  border-width: 1px;
  border-color: ${({ theme }) => theme.COLORS.BACKGROUND_500 ?? '#DDD'};
`;

export const ProgressFill = styled.View<{ percent: number; color?: string }>`
  height: 100%;
  width: ${({ percent }) => Math.max(0, Math.min(100, percent))}%;
  border-radius: 6px;
  background-color: ${({ color, theme }) => color || theme.COLORS.TERTIARY};
`;

export const InlineStats = styled.View`
  flex-direction: row;
  justify-content: space-between;
  margin-top: 6px;
`;

export const Pill = styled.View`
  align-self: flex-start;
  padding: 4px 8px;
  border-radius: 999px;
  background-color: ${({ theme }) => theme.COLORS.BACKGROUND_500 ?? '#DDD'};
  margin-bottom: 6px;
`;
