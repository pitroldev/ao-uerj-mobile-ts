import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled, { type DefaultTheme } from 'styled-components/native';

export type RadioProps = {
  selected: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

type State = { $selected: boolean; $disabled: boolean };

const color = ({
  theme,
  $selected,
  $disabled,
}: State & { theme: DefaultTheme }) =>
  $disabled
    ? theme.colors.ruleStrong
    : $selected
      ? theme.colors.accent
      : theme.colors.inkMuted;

const Ring = styled.View<State>`
  width: 20px;
  height: 20px;
  border-radius: 10px;
  border-width: 2px;
  border-color: ${color};
  align-items: center;
  justify-content: center;
`;

const Dot = styled.View<State>`
  width: 10px;
  height: 10px;
  border-radius: 5px;
  background-color: ${color};
`;

/**
 * Botão de opção (".radio"), só o desenho. Use dentro de uma `ListRow` com
 * `accessibilityRole="radio"` e `accessibilityState={{ checked }}`, ou pelo
 * `OptionList`, que já faz isso.
 */
export function Radio({ selected, disabled = false, style }: RadioProps) {
  return (
    <Ring
      $selected={selected}
      $disabled={disabled}
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {selected ? <Dot $selected={selected} $disabled={disabled} /> : null}
    </Ring>
  );
}
