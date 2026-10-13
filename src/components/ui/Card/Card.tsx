import React from 'react';
import type {
  GestureResponderEvent,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import styled, { css, useTheme } from 'styled-components/native';

export type CardProps = Omit<PressableProps, 'style' | 'children'> & {
  children?: React.ReactNode;
  /** Padding interno. Padrão 16; use 0 para conteúdo que já tem o seu. */
  padding?: number;
  /** Fundo levemente destacado (`surfaceMuted`), como o "callout" do Sobre. */
  muted?: boolean;
  /** Borda tracejada (espaço livre na agenda, dica do mural). */
  dashed?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
};

type BoxProps = { $padding: number; $muted: boolean; $dashed: boolean };

const box = css<BoxProps>`
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-style: ${({ $dashed }) => ($dashed ? 'dashed' : 'solid')};
  border-color: ${({ theme, $dashed }) =>
    $dashed ? theme.colors.ruleStrong : theme.colors.rule};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme, $muted }) =>
    $muted ? theme.colors.surfaceMuted : theme.colors.surface};
  padding: ${({ $padding }) => $padding}px;
  overflow: hidden;
`;

const StaticCard = styled.View<BoxProps>`
  ${box}
`;

const PressableCard = styled.Pressable<BoxProps>`
  ${box}
`;

/**
 * Card do sistema: sem sombra, fio de 1px, raio 12 e o canto superior direito
 * reto. Use pouco: o sistema prefere listas com fios.
 */
export function Card({
  children,
  padding = 16,
  muted = false,
  dashed = false,
  onPress,
  style,
  accessibilityRole,
  ...rest
}: CardProps) {
  const theme = useTheme();
  if (!onPress) {
    return (
      <StaticCard
        $padding={padding}
        $muted={muted}
        $dashed={dashed}
        style={style}
        accessibilityRole={accessibilityRole}
      >
        {children}
      </StaticCard>
    );
  }
  return (
    <PressableCard
      $padding={padding}
      $muted={muted}
      $dashed={dashed}
      accessibilityRole={accessibilityRole ?? 'button'}
      onPress={onPress}
      style={({ pressed }) => [
        pressed && { backgroundColor: theme.colors.surfacePressed },
        style,
      ]}
      {...rest}
    >
      {children}
    </PressableCard>
  );
}
