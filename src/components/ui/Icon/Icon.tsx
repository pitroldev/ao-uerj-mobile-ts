import React, { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from 'styled-components/native';

import {
  FILLED_GLYPHS,
  ICON_VIEWBOX,
  OUTLINED_GLYPHS,
  type IconName,
} from './glyphs';

export type { IconName };

export type IconProps = {
  /** Nome do Material Symbol (veja `glyphs.ts`). */
  name: IconName;
  /** Tamanho em dp. Padrão 22 (o `.ic` do protótipo). */
  size?: number;
  /** Cor do glifo. Padrão `theme.colors.ink`. */
  color?: string;
  /**
   * Variante preenchida (FILL 1), usada no item ativo do menu lateral e em
   * marcadores como `check_circle`. Sem a variante gerada, cai no contorno.
   */
  filled?: boolean;
  /**
   * Rótulo para leitores de tela. Sem rótulo o ícone é decorativo e fica
   * oculto da acessibilidade (o rótulo deve estar no controle que o contém).
   */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Ícone Material Symbols Outlined (peso 300) desenhado com react-native-svg. */
function IconBase({
  name,
  size,
  color,
  filled = false,
  accessibilityLabel,
  style,
  testID,
}: IconProps) {
  const theme = useTheme();
  const side = size ?? theme.sizes.icon.xl;
  const d = (filled && FILLED_GLYPHS[name]) || OUTLINED_GLYPHS[name];
  if (__DEV__ && !OUTLINED_GLYPHS[name]) {
    console.warn(
      `Icon: glifo inexistente "${name}". Rode scripts/generate-icons.cjs.`,
    );
  }
  const labelled = Boolean(accessibilityLabel);
  return (
    <Svg
      width={side}
      height={side}
      viewBox={ICON_VIEWBOX}
      style={style}
      testID={testID}
      accessible={labelled}
      accessibilityRole={labelled ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={labelled ? 'yes' : 'no-hide-descendants'}
    >
      <Path d={d} fill={color ?? theme.colors.ink} />
    </Svg>
  );
}

export const Icon = memo(IconBase);
