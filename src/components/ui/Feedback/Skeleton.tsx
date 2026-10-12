import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import styled from 'styled-components/native';

import { useReducedMotion } from '../hooks/useReducedMotion';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  /** Raio. Padrão 6. */
  radius?: number;
  /** Canto superior direito reto (blocos que imitam cards). */
  cut?: boolean;
  style?: StyleProp<ViewStyle>;
};

const Block = styled(Animated.View)<{ $h: number; $r: number; $cut: boolean }>`
  height: ${({ $h }) => $h}px;
  border-radius: ${({ $r }) => $r}px;
  border-top-right-radius: ${({ $r, $cut }) => ($cut ? 0 : $r)}px;
  background-color: ${({ theme }) => theme.colors.surfaceStrong};
`;

/**
 * Bloco de esqueleto (".sk") que pulsa suavemente. Prefira esqueleto a um
 * indicador girando no meio do conteúdo. Parado com "remover animações".
 */
export function Skeleton({
  width = '100%',
  height = 14,
  radius = 6,
  cut = false,
  style,
}: SkeletonProps) {
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduced) return;
    const step = (toValue: number) =>
      Animated.timing(pulse, {
        toValue,
        duration: 700,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      });
    const loop = Animated.loop(Animated.sequence([step(0.45), step(1)]));
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(1);
    };
  }, [pulse, reduced]);

  return (
    <Block
      $h={height}
      $r={radius}
      $cut={cut}
      style={[{ width, opacity: pulse }, style]}
    />
  );
}

export type SkeletonListProps = {
  /** Quantidade de itens. Padrão 5. */
  count?: number;
  /** Anunciado para leitores de tela. Padrão "Carregando…". */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const Wrapper = styled.View``;

const Item = styled.View`
  gap: 8px;
  padding: 14px 0px;
  border-bottom-width: ${({ theme }) => theme.borders.hairline}px;
  border-bottom-color: ${({ theme }) => theme.colors.rule};
`;

/** Lista de esqueleto (título + duas linhas de metadados por item, com fios). */
export function SkeletonList({
  count = 5,
  accessibilityLabel = 'Carregando…',
  style,
}: SkeletonListProps) {
  return (
    <Wrapper
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: true }}
      style={style}
    >
      {Array.from({ length: count }, (_, i) => (
        <Item key={i}>
          <Skeleton width={i % 2 ? '62%' : '78%'} height={16} />
          <Skeleton width="38%" height={12} />
          <Skeleton width="52%" height={12} />
        </Item>
      ))}
    </Wrapper>
  );
}

export default Skeleton;
