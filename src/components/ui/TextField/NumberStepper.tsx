import React, { useState } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { IconButton } from '../Button/IconButton';
import { Text, typeStyle } from '../Text';
import { inputColors } from './TextField';

export type NumberStepperProps = {
  /** Valor como texto (o campo aceita só dígitos). */
  value: string;
  onChangeText: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Unidade à direita ("matérias"). */
  unit?: string;
  /** Rótulo do campo para leitores de tela. */
  accessibilityLabel: string;
  /** Rótulos dos botões. Padrão "Diminuir"/"Aumentar" + rótulo. */
  decreaseLabel?: string;
  increaseLabel?: string;
  invalid?: boolean;
  maxLength?: number;
  style?: StyleProp<ViewStyle>;
};

const Root = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

const NumberInput = styled.TextInput<{
  $ring: boolean;
  $invalid: boolean;
  $focused: boolean;
}>`
  width: 64px;
  height: 48px;
  padding: 0px;
  text-align: center;
  color: ${({ theme }) => theme.colors.ink};
  border-width: ${({ theme, $ring }) =>
    $ring ? theme.borders.focus : theme.borders.hairline}px;
  border-color: ${({ theme, $invalid, $focused }) =>
    $invalid
      ? theme.status.bad.ink
      : $focused
        ? theme.colors.accent
        : theme.colors.fieldBorder};
  border-radius: ${({ theme }) => theme.radii.lg}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme }) => theme.colors.surface};
`;

const Unit = styled(Text)`
  min-width: 52px;
`;

const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };

/**
 * Contador numérico (".stepper-f"): − [campo] + e unidade. Usado no passo 1
 * do gerador e em "Configurar créditos".
 */
export function NumberStepper({
  value,
  onChangeText,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  unit,
  accessibilityLabel,
  decreaseLabel,
  increaseLabel,
  invalid = false,
  maxLength = 3,
  style,
}: NumberStepperProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const current = parseInt(value, 10);
  const base = Number.isNaN(current) ? min : current;
  const bump = (delta: number) =>
    onChangeText(String(Math.min(max, Math.max(min, base + delta))));
  const { fontFamily, fontSize } = typeStyle(theme, 'titleS');

  return (
    <Root style={style}>
      <IconButton
        icon="remove"
        variant="outlined"
        accessibilityLabel={decreaseLabel ?? `Diminuir ${accessibilityLabel}`}
        onPress={() => bump(-step)}
        disabled={!Number.isNaN(current) && current <= min}
      />
      <NumberInput
        $ring={focused || invalid}
        $invalid={invalid}
        $focused={focused}
        value={value}
        onChangeText={t =>
          onChangeText(t.replace(/\D/g, '').slice(0, maxLength))
        }
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={maxLength}
        accessibilityLabel={accessibilityLabel}
        {...inputColors(theme)}
        style={[{ fontFamily, fontSize }, TABULAR]}
      />
      <IconButton
        icon="add"
        variant="outlined"
        accessibilityLabel={increaseLabel ?? `Aumentar ${accessibilityLabel}`}
        onPress={() => bump(step)}
        disabled={!Number.isNaN(current) && current >= max}
      />
      {unit ? (
        <Unit variant="meta" tone="muted">
          {unit}
        </Unit>
      ) : null}
    </Root>
  );
}

export default NumberStepper;
