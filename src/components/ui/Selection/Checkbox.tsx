import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Icon } from '../Icon';

export type CheckboxProps = {
  checked: boolean;
  disabled?: boolean;
  /**
   * Com `onPress`, vira um controle próprio (alvo de 48dp, papel
   * "checkbox"). Sem `onPress` é só o desenho: use dentro de uma `ListRow`
   * com `accessibilityRole="checkbox"` e `accessibilityState={{ checked }}`.
   */
  onPress?: () => void;
  /** Obrigatório quando houver `onPress`. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const Box = styled.View<{ $checked: boolean; $disabled: boolean }>`
  width: ${({ theme }) => theme.sizes.checkbox}px;
  height: ${({ theme }) => theme.sizes.checkbox}px;
  border-width: 2px;
  border-color: ${({ theme, $checked, $disabled }) =>
    $disabled
      ? theme.colors.ruleStrong
      : $checked
        ? theme.colors.fill
        : theme.colors.inkMuted};
  background-color: ${({ theme, $checked, $disabled }) =>
    $checked
      ? $disabled
        ? theme.colors.ruleStrong
        : theme.colors.fill
      : 'transparent'};
  border-radius: ${({ theme }) => theme.radii.checkbox}px;
  border-top-right-radius: 0px;
  align-items: center;
  justify-content: center;
`;

const Target = styled.Pressable`
  width: ${({ theme }) => theme.sizes.touch}px;
  height: ${({ theme }) => theme.sizes.touch}px;
  align-items: center;
  justify-content: center;
`;

/** Caixa de seleção (".cb"): 20dp, borda 2, canto cortado. */
export function Checkbox({
  checked,
  disabled = false,
  onPress,
  accessibilityLabel,
  style,
}: CheckboxProps) {
  const theme = useTheme();
  const box = (
    <Box
      $checked={checked}
      $disabled={disabled}
      style={onPress ? undefined : style}
      accessibilityElementsHidden={!onPress}
      importantForAccessibility={onPress ? 'auto' : 'no-hide-descendants'}
    >
      {checked ? (
        <Icon
          name="check"
          size={theme.sizes.icon.sm}
          color={theme.colors.onFill}
        />
      ) : null}
    </Box>
  );
  if (!onPress) return box;
  return (
    <Target
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked, disabled }}
      style={style}
    >
      {box}
    </Target>
  );
}
