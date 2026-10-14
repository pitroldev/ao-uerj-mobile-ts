import { act, renderHook } from '@testing-library/react-native';
import { scheduleOnRN } from 'react-native-worklets';
import type { Camera } from '@root/modules/campus-map/domain/geometry';
import { MAP_BUFFER_DP } from '../MapLayer';
import { useMapCamera } from '../useMapCamera';
import { gestureCallbacks, panSession } from './mapGestures';

type Options = Parameters<typeof useMapCamera>[0];
const initial = { x: 10, y: 20, width: 100, height: 200 };
const options = (): Options => ({
  initialCamera: initial,
  width: 100,
  height: 200,
  resetKey: 'B:6',
  minWidth: 12,
  maxWidth: 160,
});
type CameraHandle = ReturnType<typeof useMapCamera>;

const gpuTransform = (handle: CameraHandle) =>
  (
    handle.animatedStyle as unknown as {
      transform: [
        { translateX: number },
        { translateY: number },
        { scale: number },
      ];
    }
  ).transform;

// The cached drawing starts at -buffer and its SVG includes the same margin.
// Apply the actual GPU transform to a world point, then return viewport pixels.
const worldToScreen = (
  handle: CameraHandle,
  point: readonly [number, number],
) => {
  const [x, y, scale] = gpuTransform(handle);
  const localX = ((point[0] - handle.camera.x) * 100) / handle.camera.width;
  const localY = ((point[1] - handle.camera.y) * 200) / handle.camera.height;
  return [
    x.translateX + (localX + MAP_BUFFER_DP) * scale.scale - MAP_BUFFER_DP,
    y.translateY + (localY + MAP_BUFFER_DP) * scale.scale - MAP_BUFFER_DP,
  ];
};

const expectScreenPoint = (
  handle: CameraHandle,
  point: readonly [number, number],
  pixel: readonly [number, number],
) => {
  const projected = worldToScreen(handle, point);
  expect(projected[0]).toBeCloseTo(pixel[0]);
  expect(projected[1]).toBeCloseTo(pixel[1]);
};

const expectViewport = (handle: CameraHandle, expected: Camera) => {
  const [, , scale] = gpuTransform(handle);
  const origin = worldToScreen(handle, [handle.camera.x, handle.camera.y]);
  const width = handle.camera.width / scale.scale;
  const height = handle.camera.height / scale.scale;
  expect(handle.camera.x - (origin[0] * width) / 100).toBeCloseTo(expected.x);
  expect(handle.camera.y - (origin[1] * height) / 200).toBeCloseTo(expected.y);
  expect(width).toBeCloseTo(expected.width);
  expect(height).toBeCloseTo(expected.height);
};

afterEach(() => {
  jest
    .mocked(scheduleOnRN)
    .mockImplementation((callback, ...args) => callback(...args));
});

it('moves on shared values without React renders until the pan finishes', async () => {
  let renders = 0;
  const { result } = await renderHook(() => {
    renders += 1;
    return useMapCamera(options());
  });
  const before = renders;
  const pan = panSession(result.current.gesture);
  await act(() => {
    pan.start();
    for (let frame = 0; frame < 40; frame += 1) {
      pan.move({ changeX: 0.25, changeY: 0.5, numberOfPointers: 1 });
    }
  });
  expect(renders).toBe(before);
  expect(result.current.camera).toEqual(initial);
  expectViewport(result.current, { ...initial, x: 0, y: 0 });

  await act(() => pan.finish());
  expect(renders).toBe(before + 1);
  expect(result.current.camera).toEqual({ ...initial, x: 0, y: 0 });
});

it('retains the floor raster and accurate viewport when pure pan ends without refresh', async () => {
  let renders = 0;
  const { result } = await renderHook(() => {
    renders += 1;
    return useMapCamera({ ...options(), refreshOnPanEnd: false });
  });
  const before = renders;
  const pan = panSession(result.current.gesture);
  await act(() => {
    pan.start();
    for (let frame = 0; frame < 40; frame += 1) {
      pan.move({ changeX: 0.25, changeY: 0.5, numberOfPointers: 1 });
    }
    pan.finish();
  });
  expect(renders).toBe(before);
  expect(scheduleOnRN).not.toHaveBeenCalled();
  expect(result.current.camera).toEqual(initial);
  expectViewport(result.current, { ...initial, x: 0, y: 0 });
  expectScreenPoint(result.current, [10, 20], [10, 20]);
});

it.each([true, false])(
  'balances opposite drags with asymmetric activation and missing final MOVE, refresh=%s',
  async refreshOnPanEnd => {
    const { result } = await renderHook(() =>
      useMapCamera({ ...options(), refreshOnPanEnd }),
    );
    const forward = panSession(result.current.gesture);
    await act(() => {
      forward.begin({ absoluteX: 100, absoluteY: 200 });
      forward.start({
        absoluteX: 120,
        absoluteY: 208,
        translationX: 5,
        translationY: 2,
      });
      forward.move({ changeX: 30, changeY: 12, numberOfPointers: 1 });
      forward.finish({ translationX: 45, translationY: 18 });
    });
    expectScreenPoint(result.current, [10, 20], [60, 24]);
    const backward = panSession(result.current.gesture);
    await act(() => {
      backward.begin({ absoluteX: 160, absoluteY: 224 });
      backward.start({
        absoluteX: 120,
        absoluteY: 208,
        translationX: -3,
        translationY: -1,
      });
      backward.move({ changeX: -10, changeY: -4, numberOfPointers: 1 });
      backward.finish({ translationX: -23, translationY: -9 });
    });
    expectViewport(result.current, initial);
    expectScreenPoint(result.current, [10, 20], [0, 0]);
  },
);

it('advances raw cursor for two pointers and consumes only the remaining finger delta', async () => {
  const { result } = await renderHook(() => useMapCamera(options()));
  const pan = panSession(result.current.gesture);
  await act(() => {
    pan.start();
    pan.move({ changeX: 10, changeY: 0, numberOfPointers: 1 });
    pan.move({ changeX: 100, changeY: 0, numberOfPointers: 2 });
  });
  expectViewport(result.current, { ...initial, x: 0 });
  await act(() => {
    pan.move({ changeX: 2, changeY: 0, numberOfPointers: 1 });
    pan.finish({ translationX: 115 });
  });
  expect(result.current.camera).toEqual({ ...initial, x: -5 });
});

it('does not consume a cancelled END delta', async () => {
  const { result } = await renderHook(() => useMapCamera(options()));
  const pan = panSession(result.current.gesture);
  await act(() => {
    pan.start();
    pan.move({ changeX: 10, changeY: 0, numberOfPointers: 1 });
    pan.finish({ translationX: 100 }, false);
  });
  expect(result.current.camera).toEqual({ ...initial, x: 0 });
});

it('keeps the pinch focal point fixed with GPU transforms and clamps zoom after rebasing', async () => {
  let renders = 0;
  const { result } = await renderHook(() => {
    renders += 1;
    return useMapCamera(options());
  });
  const before = renders;
  const pinch = gestureCallbacks(result.current.gesture, 'Pinch');
  await act(() => {
    pinch.onStart({ focalX: 20, focalY: 60 });
    pinch.onChange({ scaleChange: 1.25, focalX: 20, focalY: 60 });
    pinch.onChange({ scaleChange: 1, focalX: 25, focalY: 80 });
  });
  expectViewport(result.current, { x: 10, y: 16, width: 80, height: 160 });
  expectScreenPoint(result.current, [30, 80], [25, 80]);
  expect(renders).toBe(before);
  expect(scheduleOnRN).not.toHaveBeenCalled();
  await act(() => pinch.onChange({ scaleChange: 100, focalX: 25, focalY: 80 }));
  expectViewport(result.current, { x: 27, y: 70.4, width: 12, height: 24 });
  expectScreenPoint(result.current, [30, 80], [25, 80]);
  await act(() =>
    pinch.onChange({ scaleChange: 0.01, focalX: 25, focalY: 80 }),
  );
  expectViewport(result.current, { x: -10, y: -48, width: 160, height: 320 });
  expectScreenPoint(result.current, [30, 80], [25, 80]);
  for (const scaleChange of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    await act(() => pinch.onChange({ scaleChange, focalX: 25, focalY: 80 }));
    expectViewport(result.current, { x: -10, y: -48, width: 160, height: 320 });
  }
  await act(() => pinch.onFinalize());
  expect(result.current.camera.width).toBe(160);
  expect(renders).toBeGreaterThan(before);
});

it('hands off one finger to pinch and back without replaying pan translation', async () => {
  const { result } = await renderHook(() => useMapCamera(options()));
  const pan = panSession(result.current.gesture);
  const pinch = gestureCallbacks(result.current.gesture, 'Pinch');
  await act(() => {
    pan.start();
    pan.move({ changeX: 10, changeY: 0, numberOfPointers: 1 });
    pinch.onStart({ focalX: 20, focalY: 60 });
    pan.move({ changeX: 100, changeY: 100, numberOfPointers: 2 });
    pan.finish();
    pinch.onChange({ scaleChange: 1.25, focalX: 20, focalY: 60 });
  });
  expect(result.current.camera).toEqual(initial);
  expectViewport(result.current, { x: 4, y: 32, width: 80, height: 160 });
  await act(() => pinch.onFinalize());
  const resumedPan = panSession(result.current.gesture);
  await act(() => {
    resumedPan.start();
    resumedPan.move({ changeX: 2, changeY: 4, numberOfPointers: 1 });
  });
  expectViewport(result.current, { x: 2.4, y: 28.8, width: 80, height: 160 });
  await act(() => resumedPan.finish());
  expect(result.current.camera.x).toBeCloseTo(2.4);
  expect(result.current.camera.y).toBeCloseTo(28.8);
  expect(result.current.camera.width).toBe(80);
  expect(result.current.camera.height).toBe(160);
});

it.each([true, false])(
  'settles pinch-to-pan width after a continuous gesture with refreshOnPanEnd=%s',
  async refreshOnPanEnd => {
    let renders = 0;
    const { result } = await renderHook(() => {
      renders += 1;
      return useMapCamera({ ...options(), refreshOnPanEnd });
    });
    const before = renders;
    const pan = panSession(result.current.gesture);
    const pinch = gestureCallbacks(result.current.gesture, 'Pinch');
    await act(() => {
      pan.start();
      pan.move({ changeX: 10, changeY: 0, numberOfPointers: 1 });
      pinch.onStart({ focalX: 20, focalY: 60 });
      pan.move({ changeX: 100, changeY: 100, numberOfPointers: 2 });
      pinch.onChange({ scaleChange: 1.25, focalX: 20, focalY: 60 });
      pinch.onFinalize();
      pan.move({ changeX: 2, changeY: 4, numberOfPointers: 1 });
    });
    expect(result.current.camera).toEqual(initial);
    expectViewport(result.current, { x: 2.4, y: 28.8, width: 80, height: 160 });
    expect(renders).toBe(before);
    expect(scheduleOnRN).not.toHaveBeenCalled();
    await act(() => pan.finish({ translationX: 115, translationY: 106 }));
    expect(scheduleOnRN).toHaveBeenCalledTimes(1);
    expect(renders).toBe(before + 1);
    expect(result.current.camera.x).toBeCloseTo(0);
    expect(result.current.camera.y).toBeCloseTo(27.2);
    expect(result.current.camera.width).toBe(80);
    expect(result.current.camera.height).toBe(160);
  },
);

it('keeps a world point at the same screen position when the cache is rebased', async () => {
  const { result } = await renderHook(() => useMapCamera(options()));
  const pan = panSession(result.current.gesture);
  await act(() => {
    pan.start();
    pan.move({ changeX: 20, changeY: 10, numberOfPointers: 1 });
  });
  expectScreenPoint(result.current, [10, 20], [20, 10]);
  expect(result.current.animatedStyle).toMatchObject({
    transform: [{ translateX: 20 }, { translateY: 10 }, { scale: 1 }],
  });
  await act(() => pan.finish());
  expectScreenPoint(result.current, [10, 20], [20, 10]);
  expect(result.current.animatedStyle).toMatchObject({
    transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
  });
});

it('cancels active callbacks when the map is reset', async () => {
  const { result } = await renderHook(() => useMapCamera(options()));
  const pan = panSession(result.current.gesture);
  const pinch = gestureCallbacks(result.current.gesture, 'Pinch');
  await act(() => {
    pan.start();
    pan.move({ changeX: 20, changeY: 10, numberOfPointers: 1 });
    pinch.onStart({ focalX: 30, focalY: 80 });
    pinch.onChange({ scaleChange: 1.25, focalX: 30, focalY: 80 });
    result.current.reset();
    pan.move({ changeX: 200, changeY: 200, numberOfPointers: 1 });
    pinch.onChange({ scaleChange: 1.25, focalX: 30, focalY: 80 });
    pan.finish();
    pinch.onFinalize();
  });
  expect(result.current.camera).toEqual(initial);
  expectViewport(result.current, initial);
  expect(scheduleOnRN).not.toHaveBeenCalled();
});

it('ignores callbacks from the previous floor without interrupting the new pan', async () => {
  const { result, rerender } = await renderHook(
    (props: Options) => useMapCamera(props),
    { initialProps: options() },
  );
  const oldPan = panSession(result.current.gesture);
  const oldPinch = gestureCallbacks(result.current.gesture, 'Pinch');
  await rerender({ ...options(), resetKey: 'B:7' });
  const newPan = panSession(result.current.gesture);
  await act(() => {
    newPan.start();
    newPan.move({ changeX: 10, changeY: 0, numberOfPointers: 1 });
    oldPan.start();
    oldPinch.onStart({ focalX: 20, focalY: 60 });
    oldPan.move({ changeX: 100, changeY: 100, numberOfPointers: 1 });
    oldPinch.onChange({ scaleChange: 2, focalX: 20, focalY: 60 });
    oldPan.finish();
    oldPinch.onFinalize();
    newPan.move({ changeX: 5, changeY: 10, numberOfPointers: 1 });
  });
  expect(result.current.camera).toEqual(initial);
  expectViewport(result.current, { ...initial, x: -5, y: 10 });
  expect(scheduleOnRN).not.toHaveBeenCalled();
  await act(() => newPan.finish());
  expect(result.current.camera).toEqual({
    x: -5,
    y: 10,
    width: 100,
    height: 200,
  });
});

it.each(['reset', 'floor', 'button'] as const)(
  'ignores a queued gesture completion after %s',
  async change => {
    let queued: (() => void) | undefined;
    jest.mocked(scheduleOnRN).mockImplementation((callback, ...args) => {
      queued = () => callback(...args);
    });
    const { result, rerender } = await renderHook(
      (props: Options) => useMapCamera(props),
      { initialProps: options() },
    );
    const pan = panSession(result.current.gesture);
    await act(() => {
      pan.start();
      pan.move({ changeX: 20, changeY: 20, numberOfPointers: 1 });
      pan.finish();
    });
    expect(queued).toBeDefined();
    const expected =
      change === 'button' ? { x: 1, y: 2, width: 80, height: 160 } : initial;
    if (change === 'reset') await act(() => result.current.reset());
    else if (change === 'button')
      await act(() => result.current.setCamera(expected));
    else await rerender({ ...options(), resetKey: 'B:7' });
    await act(() => queued!());
    expect(result.current.camera).toEqual(expected);
    expectViewport(result.current, expected);
  },
);

it('coalesces cache boundary requests until React acknowledges the new drawing', async () => {
  const queued: (() => void)[] = [];
  jest.mocked(scheduleOnRN).mockImplementation((callback, ...args) => {
    queued.push(() => callback(...args));
  });
  const { result } = await renderHook(() => useMapCamera(options()));
  const pan = panSession(result.current.gesture);
  await act(() => {
    pan.start();
    pan.move({ changeX: 90, changeY: 0, numberOfPointers: 1 });
    for (let frame = 0; frame < 5; frame += 1) {
      pan.move({ changeX: 2, changeY: 0, numberOfPointers: 1 });
    }
  });
  expect(queued).toHaveLength(1);
  expect(result.current.camera).toEqual(initial);
  expectScreenPoint(result.current, [10, 20], [100, 0]);
  await act(() => queued[0]());
  expect(result.current.camera.x).toBe(-80);
  expectScreenPoint(result.current, [10, 20], [100, 0]);
  await act(() => pan.move({ changeX: 90, changeY: 0, numberOfPointers: 1 }));
  expect(queued).toHaveLength(2);
  expectScreenPoint(result.current, [10, 20], [190, 0]);
});

it.each(['reset', 'floor', 'button'] as const)(
  'rejects a stale queued cache rebase after %s',
  async change => {
    let queued: (() => void) | undefined;
    jest.mocked(scheduleOnRN).mockImplementation((callback, ...args) => {
      queued = () => callback(...args);
    });
    const { result, rerender } = await renderHook(
      (props: Options) => useMapCamera(props),
      { initialProps: options() },
    );
    const pan = panSession(result.current.gesture);
    await act(() => {
      pan.start();
      pan.move({ changeX: 90, changeY: 0, numberOfPointers: 1 });
    });
    expect(queued).toBeDefined();
    const expected =
      change === 'button' ? { x: 1, y: 2, width: 80, height: 160 } : initial;
    if (change === 'reset') await act(() => result.current.reset());
    else if (change === 'button')
      await act(() => result.current.setCamera(expected));
    else await rerender({ ...options(), resetKey: 'B:7' });
    await act(() => queued!());
    expect(result.current.camera).toEqual(expected);
    expectViewport(result.current, expected);
  },
);

it('ignores queued cache work and old native callbacks after unmount', async () => {
  const queued: (() => void)[] = [];
  jest.mocked(scheduleOnRN).mockImplementation((callback, ...args) => {
    queued.push(() => callback(...args));
  });
  const { result, unmount } = await renderHook(() => useMapCamera(options()));
  const pan = panSession(result.current.gesture);
  await act(() => {
    pan.start();
    pan.move({ changeX: 90, changeY: 0, numberOfPointers: 1 });
  });
  expect(queued).toHaveLength(1);
  await unmount();
  await act(() => {
    pan.start();
    pan.move({ changeX: 90, changeY: 0, numberOfPointers: 1 });
    pan.finish();
    queued[0]();
  });
  expect(queued).toHaveLength(1);
});

it('applies burst zoom button updaters to the live camera after a pan', async () => {
  const { result } = await renderHook(() => useMapCamera(options()));
  const pan = panSession(result.current.gesture);
  const widths: number[] = [];
  await act(() => {
    pan.start();
    pan.move({ changeX: 10, changeY: 0, numberOfPointers: 1 });
    for (let press = 0; press < 3; press += 1) {
      result.current.setCamera(current => {
        widths.push(current.width);
        const width = current.width / 2;
        const height = current.height / 2;
        return {
          x: current.x + (current.width - width) / 2,
          y: current.y + (current.height - height) / 2,
          width,
          height,
        };
      });
    }
  });
  expect(widths).toEqual([100, 50, 25]);
  expect(result.current.camera).toEqual({
    x: 43.75,
    y: 107.5,
    width: 12.5,
    height: 25,
  });
  expectViewport(result.current, result.current.camera);
});
