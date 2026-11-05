import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { encodeQr, qrPath } from '../domain/qrCode';

/** Margem branca em módulos: a norma pede 4 para a câmera achar o código. */
const QUIET = 4;

type Props = {
  value: string;
  /** Lado do desenho em dp, margem incluída. */
  size: number;
  accessibilityLabel: string;
};

/**
 * O QR de `value`, sempre escuro sobre branco (também no tema escuro: a
 * câmera lê o contraste, não o tema).
 */
export function QrCode({ value, size, accessibilityLabel }: Props) {
  const { side, path } = useMemo(() => {
    const matrix = encodeQr(value);
    return { side: matrix.size + QUIET * 2, path: qrPath(matrix) };
  }, [value]);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg
        width={size}
        height={size}
        viewBox={`${-QUIET} ${-QUIET} ${side} ${side}`}
      >
        <Rect x={-QUIET} y={-QUIET} width={side} height={side} fill="#FFFFFF" />
        <Path d={path} fill="#0B1220" />
      </Svg>
    </View>
  );
}
