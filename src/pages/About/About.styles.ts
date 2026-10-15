import styled from 'styled-components/native';

import { List, ListRow, Notice, Text } from '@components/ui';

export const Hero = styled.View`
  align-items: center;
`;

export const AppName = styled(Text)`
  margin-top: 14px;
`;

export const Version = styled(Text)`
  margin-top: ${({ theme }) => theme.spacing.xs}px;
`;

export const Callout = styled(Notice)`
  margin-top: ${({ theme }) => theme.spacing.xxl}px;
  padding: 14px;
  border-width: 0px;
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: 0px;
`;

export const Creator = styled.View`
  margin-top: 28px;
`;

export const Bio = styled(Text)`
  margin-top: 10px;
  margin-bottom: 18px;
  line-height: 24px;
`;

export const WebsiteLink = styled.Pressable`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md}px;
  min-height: 76px;
  padding: ${({ theme }) => theme.spacing.md}px;
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: 0px;
`;

export const WebsiteCopy = styled.View`
  flex: 1;
  min-width: 0px;
  gap: ${({ theme }) => theme.spacing.xs}px;
`;

export const SocialLinks = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm}px;
  margin-top: 10px;
`;

/** Três em telas largas; duas colunas em telas menores e uma com fonte ampliada. */
export const SocialLink = styled.Pressable<{ $expanded: boolean }>`
  flex-grow: 1;
  flex-basis: ${({ $expanded }) => ($expanded ? '100%' : '104px')};
  flex-direction: row;
  align-items: center;
  justify-content: ${({ $expanded }) => ($expanded ? 'flex-start' : 'center')};
  gap: ${({ theme }) => theme.spacing.sm}px;
  min-height: ${({ theme }) => theme.sizes.touch}px;
  padding: 10px
    ${({ theme, $expanded }) =>
      $expanded ? theme.spacing.lg : theme.spacing.sm}px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme }) => theme.colors.rule};
  border-radius: ${({ theme }) => theme.radii.md}px;
`;

export const SocialLabel = styled(Text)`
  flex-shrink: 1;
`;

export const SupportList = styled(List)`
  border-top-width: ${({ theme }) => theme.borders.hairline}px;
  border-top-color: ${({ theme }) => theme.colors.rule};
`;

export const SupportRow = styled(ListRow)`
  min-height: 80px;
  padding-top: ${({ theme }) => theme.spacing.lg}px;
  padding-bottom: ${({ theme }) => theme.spacing.lg}px;
  gap: ${({ theme }) => theme.spacing.md}px;
`;
