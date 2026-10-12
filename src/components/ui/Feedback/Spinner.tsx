import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from 'styled-components/native';

import { Icon } from '../Icon';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type SpinnerProps = {
  size?: number;
  color?: string;
  /** Rótulo para leitores de tela (ex.: "Carregando"). Sem rótulo é decorativo. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Indicador circular do sistema: o glifo `progress_activity` girando, como no
 * protótipo. Com "remover animações" ativo, fica parado.
 */
export function Spinner({
  size,
  color,
  accessibilityLabel,
  style,
}: SpinnerProps) {
  const theme = useTheme();
  const side = size ?? theme.sizes.icon.lg;
  const reduced = useReducedMotion();
  const turn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.timing(turn, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      turn.setValue(0);
    };
  }, [reduced, turn]);

  const rotate = turn.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'progressbar' : undefined}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={
        accessibilityLabel ? 'yes' : 'no-hide-descendants'
      }
      style={[{ width: side, height: side, transform: [{ rotate }] }, style]}
    >
      <Icon
        name="progress_activity"
        size={side}
        color={color ?? theme.colors.accent}
      />
    </Animated.View>
  );
}

export default Spinner;
