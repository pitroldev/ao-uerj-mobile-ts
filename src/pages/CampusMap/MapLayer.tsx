import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import Svg from 'react-native-svg';
import type { Camera } from '@root/modules/campus-map/domain/geometry';

// A bounded margin lets the GPU move the drawing without exposing empty edges.
export const MAP_BUFFER_DP = 160;

type Props = {
  camera: Camera;
  width: number;
  height: number;
  projection: 'screen' | 'world';
  animatedStyle: AnimatedStyle<ViewStyle>;
  accessibilityLabel: string;
  children: React.ReactNode;
  targets?: React.ReactNode;
};

export function MapLayer({
  camera,
  width,
  height,
  projection,
  animatedStyle,
  accessibilityLabel,
  children,
  targets,
}: Props) {
  const buffer = MAP_BUFFER_DP;
  const unit = camera.width / width;
  const viewBox =
    projection === 'world'
      ? `${camera.x - buffer * unit} ${camera.y - buffer * unit} ${camera.width + 2 * buffer * unit} ${camera.height + 2 * buffer * unit}`
      : `${-buffer} ${-buffer} ${width + 2 * buffer} ${height + 2 * buffer}`;
  return (
    <Animated.View
      pointerEvents={targets ? 'box-none' : 'none'}
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
      style={[
        styles.layer,
        { width: width + 2 * buffer, height: height + 2 * buffer },
        animatedStyle,
      ]}
    >
      <Svg
        pointerEvents="none"
        width="100%"
        height="100%"
        viewBox={viewBox}
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Svg>
      {targets ? (
        <View
          pointerEvents="box-none"
          style={[styles.targets, { width, height }]}
        >
          {targets}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: -MAP_BUFFER_DP,
    top: -MAP_BUFFER_DP,
  },
  targets: {
    position: 'absolute',
    left: MAP_BUFFER_DP,
    top: MAP_BUFFER_DP,
  },
});
