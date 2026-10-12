import React from 'react';
import { View } from 'react-native';
import { useTheme } from 'styled-components/native';

import { Skeleton, SkeletonList } from '@components/ui';
import {
  SkeletonHeader,
  SkeletonSection,
  SkeletonStat,
  SkeletonStats,
} from './MyProgress.styles';

/**
 * Carregando sem dados: o formato da tela (números, gráfico e caminho) em
 * esqueleto, no lugar de um indicador girando.
 */
export default function ProgressSkeleton() {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel="Carregando dados…"
      accessibilityState={{ busy: true }}
    >
      <SkeletonStats>
        <SkeletonStat $first>
          <Skeleton width={48} height={28} />
          <Skeleton width="70%" height={12} />
        </SkeletonStat>
        <SkeletonStat>
          <Skeleton width={56} height={28} />
          <Skeleton width="60%" height={12} />
        </SkeletonStat>
      </SkeletonStats>
      <SkeletonSection>
        <SkeletonHeader>
          <Skeleton width={130} height={18} />
        </SkeletonHeader>
        <Skeleton height={200} radius={theme.radii.xl} cut />
      </SkeletonSection>
      <SkeletonSection>
        <SkeletonHeader>
          <Skeleton width={180} height={18} />
        </SkeletonHeader>
        <SkeletonList count={3} accessibilityLabel="Carregando dados…" />
      </SkeletonSection>
    </View>
  );
}
