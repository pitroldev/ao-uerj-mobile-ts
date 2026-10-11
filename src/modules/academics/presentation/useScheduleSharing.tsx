import React, { useCallback, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useAppServices } from '@root/app/providers/AppServicesProvider';
import { ShareSchedule } from '../application/use-cases/ShareSchedule';

export function useScheduleSharing() {
  const { scheduleSharing } = useAppServices();
  const imageRef = useRef<View>(null);
  const ready = useRef(false);
  const pending = useRef(false);
  const [exporting, setExporting] = useState(false);
  const share = async (svgUri: string) => {
    if (pending.current) return;
    pending.current = true;
    setExporting(true);
    try {
      await new ShareSchedule(scheduleSharing).execute(
        ready.current ? imageRef.current : null,
        svgUri,
      );
    } finally {
      pending.current = false;
      setExporting(false);
    }
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
