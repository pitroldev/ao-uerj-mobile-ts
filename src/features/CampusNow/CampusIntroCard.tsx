import React from 'react';
import styled, { useTheme } from 'styled-components/native';

import { Button, Icon, Text } from '@components/ui';

const Box = styled.View`
  padding: ${({ theme }) => theme.spacing.lg}px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme }) => theme.colors.accentLine};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme }) => theme.colors.accentSoft};
`;

const Top = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md}px;
`;

const Body = styled.View`
  flex: 1;
  gap: ${({ theme }) => theme.spacing.xxs}px;
`;

const Actions = styled.View`
  flex-direction: row;
  gap: ${({ theme }) => theme.spacing.sm}px;
  margin-top: ${({ theme }) => theme.spacing.md}px;
`;

const Half = styled.View`
  flex: 1;
`;

/**
 * A apresentação do Agora no campus no Início, uma vez por conta: some quando
 * o aluno abre a tela ("Conhecer" ou pelo menu) ou dispensa ("Agora não").
 * Depois, o Início mostra a linha de sempre.
 */
export function CampusIntroCard({
  onOpen,
  onDismiss,
}: {
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  return (
    <Box accessibilityRole="summary">
      <Top>
        <Icon
          name="campaign"
          size={theme.sizes.icon.xl}
          color={theme.colors.accent}
        />
        <Body>
          <Text variant="body" weight="semibold" accessibilityRole="header">
            Avisos sobre o campus
          </Text>
          <Text variant="meta" tone="muted">
            Fila, elevador parado ou Wi-Fi fora: quem está lá avisa em dois
            toques.
          </Text>
        </Body>
      </Top>
      <Actions>
        <Half>
          <Button size="sm" label="Conhecer" block onPress={onOpen} />
        </Half>
        <Half>
          <Button
            variant="outline"
            size="sm"
            label="Agora não"
            block
            onPress={onDismiss}
          />
        </Half>
      </Actions>
    </Box>
  );
}
