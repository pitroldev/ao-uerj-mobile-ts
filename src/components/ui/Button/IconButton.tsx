import React from 'react';
import type {
  GestureResponderEvent,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Icon, type IconName } from '../Icon';
import { Spinner } from '../Feedback/Spinner';

export type IconButtonVariant = 'plain' | 'outlined' | 'filled';

export type IconButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  icon: IconName;
  /** Obrigatório: descreve a ação ("Abrir menu", "Limpar busca", "Fechar"). */
  accessibilityLabel: string;
  /**
   * `plain` (círculo transparente, padrão), `outlined` (contorno com canto
   * cortado, como o − e + do contador) e `filled` (círculo de acento, como o
   * botão de enviar do mural).
   */
  variant?: IconButtonVariant;
  /** Cor do ícone (variante `plain`/`outlined`). Padrão `inkMuted`. */
  color?: string;
  /** Tamanho do glifo. Padrão 22 (20 em `outlined`/`filled`). */
  iconSize?: number;
  /** Lado do alvo de toque. Mínimo e padrão 48. */
  size?: number;
  /** Usa a variante preenchida do glifo. */
  filledIcon?: boolean;
  loading?: boolean;
  /** Sobre o azul do cabeçalho/menu: ícone branco e toque claro. */
  onBrand?: boolean;
  /** Estado de um botão alternável (ex.: mostrar senha). */
  selected?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
};

const Root = styled.Pressable<{ $side: number; $variant: IconButtonVariant }>`
  width: ${({ $side }) => $side}px;
  height: ${({ $side }) => $side}px;
  align-items: center;
  justify-content: center;
  border-radius: ${({ $side, $variant, theme }) =>
    $variant === 'outlined' ? theme.radii.lg : $side / 2}px;
  ${({ $variant, theme }) =>
    $variant === 'outlined'
      ? `border-top-right-radius: 0px;
         border-width: ${theme.borders.hairline}px;
         border-color: ${theme.colors.ruleStrong};`
      : ''}
`;

/** Botão só com ícone, com alvo de toque de 48dp. */
export function IconButton({
  icon,
  accessibilityLabel,
  variant = 'plain',
  color,
  iconSize,
  size,
  filledIcon,
  loading = false,
  onBrand = false,
  selected,
  disabled,
  style,
  accessibilityState,
  ...rest
}: IconButtonProps) {
  const theme = useTheme();
  const c = theme.colors;
  const isDisabled = Boolean(disabled || loading);
  const side = Math.max(size ?? theme.sizes.touch, theme.sizes.touch);
  const glyph =
    iconSize ??
    (variant === 'plain' ? theme.sizes.icon.xl : theme.sizes.icon.lg);
  const pressedOverlay = onBrand ? c.onBrandPressed : c.pressedOverlay;

  const background = (pressed: boolean) => {
    if (variant === 'filled') {
      return isDisabled ? c.surfaceStrong : pressed ? c.fillPressed : c.fill;
    }
    if (variant === 'outlined') return pressed ? c.accentSoft : c.surface;
    return pressed ? pressedOverlay : 'transparent';
  };

  const iconColor =
    variant === 'filled'
      ? isDisabled
        ? c.inkMuted
        : c.onFill
      : isDisabled
        ? c.ruleStrong
        : (color ??
          (onBrand
            ? c.onBrand
            : variant === 'outlined'
              ? c.accent
              : c.inkMuted));

  return (
    <Root
      $side={side}
      $variant={variant}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{
        disabled: isDisabled,
        // booleano explícito: no Android, `undefined` não limpa o busy anterior
        busy: loading,
        selected,
        ...accessibilityState,
      }}
      disabled={isDisabled}
      style={({ pressed }) => [{ backgroundColor: background(pressed) }, style]}
      {...rest}
    >
      {loading ? (
        <Spinner
          size={glyph}
          color={variant === 'filled' ? c.onFill : c.accent}
        />
      ) : (
        <Icon name={icon} size={glyph} filled={filledIcon} color={iconColor} />
      )}
    </Root>
  );
}
