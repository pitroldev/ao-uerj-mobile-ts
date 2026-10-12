import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { useReducedMotion } from '../hooks/useReducedMotion';

export type SwitchProps = {
  value: boolean;
  /**
   * Com `onValueChange` vira um controle próprio (alvo de 48dp, papel
   * "switch"). Sem ele é só o desenho, para uma `ListRow` com
   * `accessibilityRole="switch"` e `accessibilityState={{ checked }}`.
   */
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  /** Obrigatório quando houver `onValueChange`. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const Track = styled.View<{ $on: boolean; $disabled: boolean }>`
  width: ${({ theme }) => theme.sizes.switch.width}px;
  height: ${({ theme }) => theme.sizes.switch.height}px;
  border-radius: 16px;
  border-width: 2px;
  border-color: ${({ theme, $on }) =>
    $on ? theme.colors.accent : theme.colors.fieldBorder};
  background-color: ${({ theme, $on }) =>
    $on ? theme.colors.accent : theme.colors.surfaceStrong};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
`;

const Thumb = styled(Animated.View)<{ $on: boolean }>`
  position: absolute;
  top: 2px;
  left: 2px;
  width: 24px;
  height: 24px;
  border-radius: 12px;
  background-color: ${({ theme, $on }) =>
    $on ? theme.colors.onAccent : theme.colors.inkMuted};
`;

const Target = styled.Pressable`
  min-width: ${({ theme }) => theme.sizes.touch}px;
  min-height: ${({ theme }) => theme.sizes.touch}px;
  align-items: center;
  justify-content: center;
`;

/** Interruptor (".switch"): trilho 52×32, botão que cresce ao ligar. */
export function Switch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  style,
}: SwitchProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      anim.setValue(value ? 1 : 0);
      return;
    }
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 180,
      easing: Easing.bezier(...theme.motion.easing),
      useNativeDriver: true,
    }).start();
  }, [anim, reduced, theme.motion.easing, value]);

  const transform = [
    {
      translateX: anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 20],
      }),
    },
    {
      scale: anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.6667, 1],
      }),
    },
  ];

  const track = (
    <Track
      $on={value}
      $disabled={disabled}
      style={onValueChange ? undefined : style}
      accessibilityElementsHidden={!onValueChange}
      importantForAccessibility={onValueChange ? 'auto' : 'no-hide-descendants'}
    >
      <Thumb $on={value} style={{ transform }} />
    </Track>
  );

  if (!onValueChange) return track;
  return (
    <Target
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      style={style}
    >
      {track}
    </Target>
  );
}

export default Switch;
