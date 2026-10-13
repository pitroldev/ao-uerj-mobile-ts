import React, { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from 'styled-components/native';

import { AO_LOGO_PATHS, AO_LOGO_VIEWBOX } from './logoPaths';

const [, , VB_W, VB_H] = AO_LOGO_VIEWBOX.split(/\s+/).map(Number);

export type AoLogoProps = {
  /** Largura em dp; a altura segue a proporção do logo. Padrão 36. */
  width?: number;
  /** Cor do logo. Padrão `theme.colors.onBrand` (branco sobre o azul). */
  color?: string;
  /** Rótulo acessível. Padrão "AO UERJ". Passe `null` se for decorativo. */
  accessibilityLabel?: string | null;
  style?: StyleProp<ViewStyle>;
};

/**
 * Logo AO (src/assets/AO_Logo.svg) recolorível. Branco no cabeçalho, no login
 * e no carregamento; `theme.colors.logo` sobre superfícies claras (Sobre).
 */
function AoLogoBase({
  width = 36,
  color,
  accessibilityLabel = 'AO UERJ',
  style,
}: AoLogoProps) {
  const theme = useTheme();
  const fill = color ?? theme.colors.onBrand;
  const labelled = Boolean(accessibilityLabel);
  return (
    <Svg
      width={width}
      height={(width * VB_H) / VB_W}
      viewBox={AO_LOGO_VIEWBOX}
      style={style}
      accessible={labelled}
      accessibilityRole={labelled ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel ?? undefined}
      importantForAccessibility={labelled ? 'yes' : 'no-hide-descendants'}
    >
      {AO_LOGO_PATHS.map((d, i) => (
        <Path key={i} d={d} fill={fill} />
      ))}
    </Svg>
  );
}

export const AoLogo = memo(AoLogoBase);
