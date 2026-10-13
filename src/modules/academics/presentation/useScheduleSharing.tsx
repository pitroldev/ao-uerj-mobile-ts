import React, { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, type ViewInstance } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useAppServices } from '@root/app/providers/AppServicesProvider';
import { usePositiveMoment } from '@root/modules/delivery/presentation/DeliveryProvider';
import { ShareSchedule } from '../application/use-cases/ShareSchedule';

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
        <SvgXml xml={svgString} />
      </View>
    ),
    [],
  );
  return { share, exporting, SvgRenderer };
}

const styles = StyleSheet.create({
  capture: { position: 'absolute', left: -10000, top: -10000 },
});
