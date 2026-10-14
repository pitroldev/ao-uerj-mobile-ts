import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { ViewStyle } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { Camera } from '@root/modules/campus-map/domain/geometry';
import { MAP_BUFFER_DP } from './MapLayer';

type Options = {
  initialCamera: Camera;
  width: number;
  height: number;
  resetKey: string;
  minWidth: number;
  maxWidth: number;
  positionLimit?: number;
  refreshOnPanEnd?: boolean;
};

/** Move the cached drawing on the UI thread; rebase only at its bounds or gesture end. */
export function useMapCamera({
  initialCamera,
  width,
  height,
  resetKey,
  minWidth,
  maxWidth,
  positionLimit,
  refreshOnPanEnd = true,
}: Options) {
  const {
    x: initialX,
    y: initialY,
    width: initialWidth,
    height: initialHeight,
  } = initialCamera;
  const key = `${resetKey}|${initialX}:${initialY}:${initialWidth}:${initialHeight}`;
  const [manual, setManual] = useState<{ key: string; camera: Camera } | null>(
    null,
  );
  const camera = manual?.key === key ? manual.camera : initialCamera;
  const activeKey = useRef(key);
  const activeRevision = useRef(0);
  const revision = useSharedValue(0);
  const currentKey = useSharedValue(key);
  const live = useSharedValue(initialCamera);
  const rendered = useSharedValue(initialCamera);
  const rebasePending = useSharedValue(false);
  const panning = useSharedValue(false);
  const pinching = useSharedValue(false);
  const focal = useSharedValue({ x: 0, y: 0 });
  const panDown = useSharedValue<{ x: number; y: number } | null>(null);
  const panTranslation = useSharedValue({ x: 0, y: 0, pointers: 0 });

  useLayoutEffect(() => {
    activeKey.current = key;
    currentKey.set(key);
    activeRevision.current += 1;
    revision.set(activeRevision.current);
    live.set({
      x: initialX,
      y: initialY,
      width: initialWidth,
      height: initialHeight,
    });
    panning.set(false);
    pinching.set(false);
    rebasePending.set(false);
    panDown.set(null);
    return () => {
      activeKey.current = '';
      currentKey.set('');
      activeRevision.current += 1;
      revision.set(activeRevision.current);
      panning.set(false);
      pinching.set(false);
      rebasePending.set(false);
      panDown.set(null);
    };
  }, [
    key,
    initialX,
    initialY,
    initialWidth,
    initialHeight,
    live,
    panning,
    pinching,
    revision,
    currentKey,
    rebasePending,
    panDown,
  ]);

  useLayoutEffect(() => {
    rendered.set(camera);
    rebasePending.set(false);
  }, [camera, rendered, rebasePending]);

  const commit = useCallback(
    (next: Camera, gestureKey: string, epoch: number) => {
      if (activeKey.current === gestureKey && activeRevision.current === epoch)
        setManual({ key: gestureKey, camera: next });
    },
    [],
  );

  const rebaseIfNeeded = (next: Camera) => {
    'worklet';
    if (rebasePending.get()) return;
    const base = rendered.get();
    const scale = base.width / next.width;
    const unit = next.width / width;
    const tx = (base.x - next.x) / unit;
    const ty = (base.y - next.y) / unit;
    const reserve = MAP_BUFFER_DP / 2;
    if (
      tx - MAP_BUFFER_DP * scale > -reserve ||
      tx + (width + MAP_BUFFER_DP) * scale < width + reserve ||
      ty - MAP_BUFFER_DP * scale > -reserve ||
      ty + (height + MAP_BUFFER_DP) * scale < height + reserve ||
      scale > 1.5 ||
      scale < 1 / 1.5
    ) {
      rebasePending.set(true);
      scheduleOnRN(commit, next, key, revision.get());
    }
  };

  const movePan = (dx: number, dy: number) => {
    'worklet';
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (!dx && !dy)) return;
    const current = live.get();
    const unit = current.width / width;
    let x = current.x - dx * unit;
    let y = current.y - dy * unit;
    if (positionLimit !== undefined) {
      x = Math.max(-positionLimit, Math.min(positionLimit, x));
      y = Math.max(-positionLimit, Math.min(positionLimit, y));
    }
    const next = { ...current, x, y };
    live.set(next);
    rebaseIfNeeded(next);
  };

  const pan = Gesture.Pan()
    .minDistance(6)
    .onBegin(event => {
      'worklet';
      if (currentKey.get() !== key) return;
      panDown.set({ x: event.absoluteX, y: event.absoluteY });
    })
    // oxlint-disable-next-line react/refs
    .onStart(event => {
      'worklet';
      if (currentKey.get() !== key) return;
      panning.set(true);
      panTranslation.set({
        x: event.translationX,
        y: event.translationY,
        pointers: event.numberOfPointers,
      });
      if (event.numberOfPointers !== 1 || pinching.get()) return;
      // Android resets native translation at activation. Recover the distance
      // already travelled from DOWN, which varies when drawing blocks input.
      const down = panDown.get();
      movePan(
        down ? event.absoluteX - down.x : event.translationX,
        down ? event.absoluteY - down.y : event.translationY,
      );
    })
    // oxlint-disable-next-line react/refs
    .onUpdate(event => {
      'worklet';
      if (currentKey.get() !== key) return;
      if (!panning.get()) return;
      const previous = panTranslation.get();
      panTranslation.set({
        x: event.translationX,
        y: event.translationY,
        pointers: event.numberOfPointers,
      });
      // Advance the cursor during pinch too: native translation compensates
      // for pointer changes, so the remaining finger resumes continuously.
      if (event.numberOfPointers === 1 && !pinching.get())
        movePan(
          event.translationX - previous.x,
          event.translationY - previous.y,
        );
    })
    // Gesture callbacks execute after render, on the UI thread.
    // oxlint-disable-next-line react/refs
    .onFinalize((event, success) => {
      'worklet';
      if (currentKey.get() !== key) return;
      if (!panning.get()) return;
      const previous = panTranslation.get();
      // END can carry a final movement with no preceding UPDATE.
      if (success && !pinching.get() && previous.pointers === 1)
        movePan(
          event.translationX - previous.x,
          event.translationY - previous.y,
        );
      panning.set(false);
      panDown.set(null);
      if (
        !pinching.get() &&
        (refreshOnPanEnd || live.get().width !== rendered.get().width)
      )
        scheduleOnRN(commit, live.get(), key, revision.get());
    });

  const pinch = Gesture.Pinch()
    .onStart(event => {
      'worklet';
      if (currentKey.get() !== key) return;
      pinching.set(true);
      focal.set({ x: event.focalX, y: event.focalY });
    })
    // oxlint-disable-next-line react/refs
    .onChange(event => {
      'worklet';
      if (currentKey.get() !== key) return;
      if (
        !pinching.get() ||
        !Number.isFinite(event.scaleChange) ||
        event.scaleChange <= 0
      )
        return;
      const current = live.get();
      const previous = focal.get();
      const nextWidth = Math.max(
        minWidth,
        Math.min(maxWidth, current.width / event.scaleChange),
      );
      const nextHeight = (nextWidth * current.height) / current.width;
      let x =
        current.x +
        (previous.x * current.width - event.focalX * nextWidth) / width;
      let y =
        current.y +
        (previous.y * current.height - event.focalY * nextHeight) / height;
      if (positionLimit !== undefined) {
        x = Math.max(-positionLimit, Math.min(positionLimit, x));
        y = Math.max(-positionLimit, Math.min(positionLimit, y));
      }
      focal.set({ x: event.focalX, y: event.focalY });
      const next = { x, y, width: nextWidth, height: nextHeight };
      live.set(next);
      rebaseIfNeeded(next);
    })
    // Gesture callbacks execute after render, on the UI thread.
    // oxlint-disable-next-line react/refs
    .onFinalize(() => {
      'worklet';
      if (currentKey.get() !== key) return;
      if (!pinching.get()) return;
      pinching.set(false);
      if (!panning.get()) scheduleOnRN(commit, live.get(), key, revision.get());
    });

  const gesture = Gesture.Simultaneous(pan, pinch);
  const animatedStyle = useAnimatedStyle<ViewStyle>(() => {
    const current = live.get();
    const base = rendered.get();
    const unit = current.width / width;
    const scale = base.width / current.width;
    return {
      transformOrigin: '0% 0%',
      transform: [
        {
          translateX: (base.x - current.x) / unit + MAP_BUFFER_DP * (1 - scale),
        },
        {
          translateY: (base.y - current.y) / unit + MAP_BUFFER_DP * (1 - scale),
        },
        { scale },
      ],
    };
  });

  const setCamera = (update: Camera | ((current: Camera) => Camera)) => {
    const next = typeof update === 'function' ? update(live.get()) : update;
    activeRevision.current += 1;
    revision.set(activeRevision.current);
    panning.set(false);
    pinching.set(false);
    rebasePending.set(false);
    panDown.set(null);
    live.set(next);
    setManual({ key, camera: next });
  };
  const reset = () => {
    activeRevision.current += 1;
    revision.set(activeRevision.current);
    panning.set(false);
    pinching.set(false);
    rebasePending.set(false);
    panDown.set(null);
    live.set(initialCamera);
    setManual(null);
  };
  return { camera, gesture, animatedStyle, setCamera, reset };
}
