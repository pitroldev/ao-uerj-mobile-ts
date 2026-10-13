import React, { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from 'styled-components/native';

export type EdgeFadeProps = {
  /** Borda onde a cor é sólida: `start` (esquerda) ou `end` (direita). */
  side: 'start' | 'end';
  /** Largura do esmaecimento em dp. Padrão 20. */
  width?: number;
  /** Cor do fundo por trás da faixa rolável. Padrão `theme.colors.background`. */
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Esmaecimento da borda de uma faixa rolável na horizontal (o
 * `mask-image: linear-gradient(...)` de ".chips.scroll" e ".steps"): indica
 * que há mais conteúdo além da borda. Coloque dentro de um contêiner com
 * `position: relative` (padrão do RN), depois da `ScrollView`. Não recebe
 * toques nem aparece para leitores de tela.
 */
export function EdgeFade({ side, width = 20, color, style }: EdgeFadeProps) {
  const theme = useTheme();
  const fill = color ?? theme.colors.background;
  const id = `edge-fade-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const solidAt = side === 'start' ? 0 : 1;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.edge,
        side === 'start' ? styles.start : styles.end,
        { width },
        style,
      ]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            <Stop offset={solidAt} stopColor={fill} stopOpacity={1} />
            <Stop offset={1 - solidAt} stopColor={fill} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  edge: { position: 'absolute', top: 0, bottom: 0 },
  start: { left: 0 },
  end: { right: 0 },
});
