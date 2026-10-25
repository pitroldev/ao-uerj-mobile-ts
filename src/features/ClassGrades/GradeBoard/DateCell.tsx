import React from 'react';
import styled, { useTheme } from 'styled-components/native';

import { Text } from '@components/ui';

/** O alvo de toque das células (28dp de altura) chega a 48dp. */
const HIT_SLOP = { top: 10, bottom: 10, left: 2, right: 2 };

const Box = styled.View`
  min-width: ${({ theme }) => theme.sizes.gradeCell.width}px;
  height: ${({ theme }) => theme.sizes.gradeCell.height}px;
  padding: 0px 4px;
  align-items: center;
  justify-content: center;
  border-width: 1.5px;
  border-style: dashed;
  border-color: ${({ theme }) => theme.colors.accent};
  border-radius: ${({ theme }) => theme.radii.sm}px;
  border-top-right-radius: 0px;
`;

const Touch = styled.Pressable`
  align-items: center;
`;

/** Amostra da data anotada na legenda: a célula tracejada, em miniatura. */
export const DateSwatch = styled.View`
  width: 14px;
  height: 10px;
  border-width: 1.5px;
  border-style: dashed;
  border-color: ${({ theme }) => theme.colors.accent};
  border-radius: 3px;
  border-top-right-radius: 0px;
`;

/**
 * Data anotada pelo aluno no lugar da nota que ainda não saiu ("24/11"),
 * tracejada no acento. O toque abre a avaliação.
 */
export function DateCell({
  label,
  accessibilityLabel,
  onPress,
}: {
  /** "24/11". */
  label: string;
  accessibilityLabel: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Touch
      onPress={onPress}
      disabled={!onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => pressed && { opacity: 0.6 }}
    >
      <Box>
        <Text
          variant="caption"
          weight="semibold"
          color={theme.colors.accent}
          tabular
          numberOfLines={1}
        >
          {label}
        </Text>
      </Box>
    </Touch>
  );
}

/** Uma célula de nota (vazia ou a PF necessária) que anota a data da prova. */
export function AnnotateCell({
  children,
  accessibilityLabel,
  onPress,
}: {
  children: React.ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Touch
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Anota a data da prova"
      style={({ pressed }) => pressed && { opacity: 0.6 }}
    >
      {children}
    </Touch>
  );
}
