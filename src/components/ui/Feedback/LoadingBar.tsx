import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  useAnimatedValue,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import styled from 'styled-components/native';

import { useReducedMotion } from '../hooks/useReducedMotion';

export type LoadingBarProps = {
  /**
   * `accent` sobre superfícies claras (atualizando dados); `onBrand` sobre o
   * azul (tela de carregamento).
   */
  tone?: 'accent' | 'onBrand';
  /** Largura fixa (ex.: 120 no carregamento). Padrão: a do pai. */
  width?: number;
  /** Espessura. Padrão 3. */
  height?: number;
  /** Rótulo anunciado ("Atualizando dados…"). Sem rótulo é decorativa. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

type ToneProps = { $onBrand: boolean; $h: number };

const Track = styled.View<ToneProps & { $w?: number }>`
  width: ${({ $w }) => ($w != null ? `${$w}px` : '100%')};
  height: ${({ $h }) => $h}px;
  border-radius: ${({ $h }) => $h}px;
  overflow: hidden;
  background-color: ${({ theme, $onBrand }) =>
    $onBrand ? theme.colors.onBrandTrack : theme.colors.accentSoft};
`;

const Segment = styled(Animated.View)<ToneProps & { $w: number }>`
  position: absolute;
  top: 0px;
  bottom: 0px;
  left: 0px;
  width: ${({ $w }) => $w}px;
  border-radius: ${({ $h }) => $h}px;
  background-color: ${({ theme, $onBrand }) =>
    $onBrand ? theme.colors.onBrand : theme.colors.accent};
`;

/**
 * Barra fina indeterminada (".lin"): um segmento de 40% que atravessa o
 * trilho. É o indicador "atualizando" discreto e o da tela de carregamento.
 */
export function LoadingBar({
  tone = 'accent',
  width,
  height = 3,
  accessibilityLabel,
  style,
  testID,
}: LoadingBarProps) {
  const reduced = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(width ?? 0);
  const x = useAnimatedValue(0);

  useEffect(() => {
    if (reduced || !trackWidth) return;
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 1300,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      x.setValue(0);
    };
  }, [reduced, trackWidth, x]);

  const seg = trackWidth * 0.4;
  const translateX = reduced
    ? trackWidth * 0.3
    : x.interpolate({ inputRange: [0, 1], outputRange: [-seg, trackWidth] });
  const onLayout = (e: LayoutChangeEvent) => {
    if (width == null) setTrackWidth(e.nativeEvent.layout.width);
  };
  const onBrand = tone === 'onBrand';

  return (
    <Track
      $onBrand={onBrand}
      $h={height}
      $w={width}
      style={style}
      testID={testID}
      onLayout={onLayout}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'progressbar' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion={accessibilityLabel ? 'polite' : undefined}
      importantForAccessibility={
        accessibilityLabel ? 'yes' : 'no-hide-descendants'
      }
    >
      <Segment
        $onBrand={onBrand}
        $h={height}
        $w={seg}
        style={{ transform: [{ translateX }] }}
      />
    </Track>
  );
}

export type UpdatingBarProps = {
  /** Texto anunciado. Padrão "Atualizando dados…". */
  label?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * "Atualizando" discreto: barra fina de acento com o rótulo anunciado para
 * leitores de tela. Use quando já há dados na tela e eles estão sendo
 * renovados em segundo plano.
 */
export function UpdatingBar({
  label = 'Atualizando dados…',
  style,
}: UpdatingBarProps) {
  return <LoadingBar tone="accent" accessibilityLabel={label} style={style} />;
}
