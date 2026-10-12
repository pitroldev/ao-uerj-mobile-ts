import React from 'react';
import type {
  GestureResponderEvent,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import styled, { useTheme, type DefaultTheme } from 'styled-components/native';

import { Icon, type IconName } from '../Icon';
import { Spinner } from '../Feedback/Spinner';
import { Text } from '../Text';

export type ButtonVariant = 'primary' | 'outline' | 'text' | 'link';
export type ButtonSize = 'md' | 'sm' | 'xs';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  /** Rótulo. Sem rótulo e com `icon`, vira um botão quadrado de 48 (exige `accessibilityLabel`). */
  label?: string;
  /**
   * `primary` (preenchido, ação principal), `outline` (contornado, ação
   * secundária), `text` (só texto, ações de seção como "Compartilhar grade")
   * e `link` (largura total, centralizado, como "Não possui acesso…").
   */
  variant?: ButtonVariant;
  /** `md` 15px, `sm` 14px, `xs` 13px (ação dentro de aviso). Todos com 48dp de altura. */
  size?: ButtonSize;
  icon?: IconName;
  iconPosition?: 'start' | 'end';
  /** Mostra o indicador girando, desabilita e marca `busy`. */
  loading?: boolean;
  /** Rótulo enquanto carrega (ex.: "Entrando…"). */
  loadingLabel?: string;
  /** Ocupa toda a largura disponível. */
  block?: boolean;
  /** Estado ligado de um botão alternável (atalho "Manhã" no gerador). */
  selected?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
};

type Palette = { bg: string; border: string; fg: string };

function palette(
  theme: DefaultTheme,
  variant: ButtonVariant,
  disabled: boolean,
  pressed: boolean,
  selected: boolean,
): Palette {
  const c = theme.colors;
  if (disabled && (variant === 'primary' || variant === 'outline')) {
    return { bg: c.surfaceStrong, border: c.surfaceStrong, fg: c.inkMuted };
  }
  switch (variant) {
    case 'primary':
      return {
        bg: pressed ? c.accentPressed : c.accent,
        border: pressed ? c.accentPressed : c.accent,
        fg: c.onAccent,
      };
    case 'outline':
      return {
        bg: pressed ? c.accentSoft : c.surface,
        border: c.ruleStrong,
        fg: c.accent,
      };
    case 'link':
      return {
        bg: 'transparent',
        border: 'transparent',
        fg: disabled ? c.inkMuted : c.accent,
      };
    default:
      return {
        bg: pressed || selected ? c.accentSoft : 'transparent',
        border: 'transparent',
        fg: disabled ? c.inkMuted : c.accent,
      };
  }
}

const PADDING: Record<ButtonVariant, Record<ButtonSize, number>> = {
  primary: { md: 20, sm: 16, xs: 12 },
  outline: { md: 20, sm: 16, xs: 12 },
  text: { md: 12, sm: 10, xs: 8 },
  link: { md: 12, sm: 12, xs: 8 },
};

const Root = styled.Pressable<{
  $padding: number;
  $iconOnly: boolean;
  $gap: number;
  $stretch: boolean;
  $border: boolean;
}>`
  min-height: ${({ theme }) => theme.sizes.touch}px;
  ${({ theme, $iconOnly }) =>
    $iconOnly ? `min-width: ${theme.sizes.touch}px;` : ''}
  padding: 0px ${({ $padding }) => $padding}px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: ${({ $gap }) => $gap}px;
  border-radius: ${({ theme }) => theme.radii.lg}px;
  border-width: ${({ theme, $border }) =>
    $border ? theme.borders.hairline : 0}px;
  ${({ $stretch }) => ($stretch ? 'align-self: stretch;' : '')}
`;

const UNDERLINE = { textDecorationLine: 'underline' } as const;

/** Botão do design system (raio 10, altura mínima 48). */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'start',
  loading = false,
  loadingLabel,
  block = false,
  selected,
  disabled,
  style,
  accessibilityLabel,
  accessibilityState,
  onPress,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = Boolean(disabled || loading);
  const iconOnly = !label && Boolean(icon);
  const textVariant =
    size === 'md' && variant !== 'link'
      ? 'button'
      : size === 'xs'
      ? 'meta'
      : 'buttonSmall';
  const iconSize = size === 'md' ? theme.sizes.icon.lg : theme.sizes.icon.md;
  const shownLabel = loading && loadingLabel ? loadingLabel : label;
  const colorsFor = (pressed: boolean) =>
    palette(theme, variant, isDisabled, pressed, Boolean(selected));

  return (
    <Root
      $padding={iconOnly ? 0 : PADDING[variant][size]}
      $iconOnly={iconOnly}
      $gap={size === 'xs' ? 6 : 8}
      $stretch={block || variant === 'link'}
      $border={variant !== 'link'}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (iconOnly ? undefined : shownLabel)
      }
      accessibilityState={{
        disabled: isDisabled,
        // booleano explícito: no Android, `undefined` não limpa o busy anterior
        busy: loading,
        selected,
        ...accessibilityState,
      }}
      disabled={isDisabled}
      onPress={onPress}
      hitSlop={size === 'xs' ? 4 : undefined}
      style={({ pressed }) => {
        const p = colorsFor(pressed);
        return [{ backgroundColor: p.bg, borderColor: p.border }, style];
      }}
      {...rest}
    >
      {({ pressed }) => {
        const p = colorsFor(pressed);
        return (
          <>
            {loading ? (
              <Spinner size={iconSize} color={p.fg} />
            ) : icon && iconPosition === 'start' ? (
              <Icon name={icon} size={iconSize} color={p.fg} />
            ) : null}
            {shownLabel ? (
              <Text
                variant={textVariant}
                weight="semibold"
                color={p.fg}
                numberOfLines={variant === 'link' ? undefined : 1}
                align="center"
                style={variant === 'link' && pressed ? UNDERLINE : undefined}
              >
                {shownLabel}
              </Text>
            ) : null}
            {!loading && icon && iconPosition === 'end' ? (
              <Icon name={icon} size={iconSize} color={p.fg} />
            ) : null}
          </>
        );
      }}
    </Root>
  );
}

export default Button;
