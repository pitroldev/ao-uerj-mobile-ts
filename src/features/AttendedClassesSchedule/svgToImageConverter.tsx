import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { SvgXml } from 'react-native-svg';

import { AttendedClassesSchedule } from './types';
import { buildWeekSvgDataUri, SvgThemeColors } from './svgExport';

export const useSvgToImage = () => {
  const [isConverting, setIsConverting] = useState(false);

  const svgRef = useRef<View>(null);

  const convertSvgToImage = React.useCallback(
    async (
      data: AttendedClassesSchedule[],
      colors: SvgThemeColors,
    ): Promise<string> => {
      try {
        setIsConverting(true);

        const svgDataUri = buildWeekSvgDataUri(data, colors);

        const base64Svg = svgDataUri.replace('data:image/svg+xml;base64,', '');

        // Aguarda um tick para garantir que o SVG foi renderizado
        await new Promise(resolve => setTimeout(resolve, 100));

        if (svgRef.current) {
          const uri = await captureRef(svgRef.current, {
            format: 'png',
            quality: 1,
          });
          return uri;
        } else {
          throw new Error('Referência do SVG não encontrada');
        }
      } catch (error) {
        console.error('Erro ao converter SVG para imagem:', error);
        throw error;
      } finally {
        setIsConverting(false);
      }
    },
    [],
  );

  const SvgRenderer = React.useCallback(
    ({ svgString }: { svgString: string }) => (
      <View
        ref={svgRef}
        collapsable={false}
        style={{
          // Renderiza fora da tela
          position: 'absolute',
          top: -10000,
          left: -10000,
          opacity: 0,
        }}
      >
        <SvgXml xml={svgString} />
      </View>
    ),
    [],
  );

  return {
    convertSvgToImage,
    SvgRenderer,
    svgRef,
    isConverting,
  };
};

export const convertSvgToImageFallback = async (
  data: AttendedClassesSchedule[],
  colors: SvgThemeColors,
): Promise<string> => {
  try {
    const svgDataUri = buildWeekSvgDataUri(data, colors);

    const pngDataUri = svgDataUri.replace('image/svg+xml', 'image/png');

    return pngDataUri;
  } catch (error) {
    console.error('Erro ao converter SVG para imagem (fallback):', error);
    throw error;
  }
};
