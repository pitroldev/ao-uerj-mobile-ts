import React, { useCallback, useRef, useState } from 'react';
import { PixelRatio, StyleSheet, View, type ViewInstance } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useAppServices } from '@root/app/providers/AppServicesProvider';
import { usePositiveMoment } from '@root/modules/delivery/presentation/DeliveryProvider';
import { ShareSchedule } from '../application/use-cases/ShareSchedule';

/** Largura e altura do SVG (as do desenho, em pixels da imagem final). */
function svgSize(svg: string): { width: number; height: number } | null {
  const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? '';
  const width = Number(/\swidth="([\d.]+)"/.exec(root)?.[1]);
  const height = Number(/\sheight="([\d.]+)"/.exec(root)?.[1]);
  return width > 0 && height > 0 ? { width, height } : null;
}

export function useScheduleSharing() {
  const { scheduleSharing } = useAppServices();
  const positiveMoment = usePositiveMoment();
  const imageRef = useRef<ViewInstance>(null);
  const ready = useRef(false);
  const pending = useRef(false);
  const [exporting, setExporting] = useState(false);
  const share = async (svgUri: string) => {
    if (pending.current) return;
    pending.current = true;
    setExporting(true);
    // `.finally` da promessa: o React Compiler 1.0 não compila try/finally.
    const shared = await new ShareSchedule(scheduleSharing)
      .execute(ready.current ? imageRef.current : null, svgUri)
      .finally(() => {
        pending.current = false;
        setExporting(false);
      });
    if (shared) positiveMoment();
  };
  const SvgRenderer = useCallback(
    ({ svgString }: { svgString: string }) => (
      <View
        ref={imageRef}
        collapsable={false}
        onLayout={({ nativeEvent }) => {
          ready.current =
            nativeEvent.layout.width > 0 && nativeEvent.layout.height > 0;
        }}
        style={styles.capture}
      >
        <SvgXml xml={svgString} {...pixelSize(svgString)} />
      </View>
    ),
    [],
  );
  return { share, exporting, SvgRenderer };
}

/**
 * Tamanho em dp para a captura sair com os pixels do desenho (1080 de largura)
 * em qualquer densidade de tela; o SVG é vetor e escala sem perder nitidez.
 */
function pixelSize(svg: string) {
  const size = svgSize(svg);
  if (!size) return {};
  const ratio = PixelRatio.get();
  return { width: size.width / ratio, height: size.height / ratio };
}

const styles = StyleSheet.create({
  capture: { position: 'absolute', left: -10000, top: -10000 },
});
