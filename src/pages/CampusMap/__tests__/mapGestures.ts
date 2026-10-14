type NativeEvent = Record<string, number>;
type Callbacks = {
  onBegin: (event: NativeEvent) => void;
  onStart: (event: NativeEvent) => void;
  onChange: (event: NativeEvent) => void;
  onUpdate: (event: NativeEvent) => void;
  onFinalize: (event?: NativeEvent, success?: boolean) => void;
};

export const gestureCallbacks = (gesture: unknown, type: string) =>
  (
    gesture as { gestures: { type: string; callbacks: Callbacks }[] }
  ).gestures.find(item => item.type === type)!.callbacks;

/** Emit Android's absolute activation coordinates and cumulative translations. */
export function panSession(gesture: unknown) {
  const callbacks = gestureCallbacks(gesture, 'Pan');
  let began = false;
  let down = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let startRaw = { x: 0, y: 0 };
  let raw = { x: 0, y: 0 };
  const event = (overrides: NativeEvent = {}) => ({
    absoluteX: start.x + raw.x - startRaw.x,
    absoluteY: start.y + raw.y - startRaw.y,
    translationX: raw.x,
    translationY: raw.y,
    numberOfPointers: 1,
    ...overrides,
  });
  const begin = (overrides: NativeEvent = {}) => {
    down = { x: overrides.absoluteX ?? 0, y: overrides.absoluteY ?? 0 };
    start = down;
    startRaw = { x: 0, y: 0 };
    raw = { x: 0, y: 0 };
    began = true;
    callbacks.onBegin(event(overrides));
  };
  return {
    begin,
    start: (overrides: NativeEvent = {}) => {
      if (!began) begin();
      start = {
        x: overrides.absoluteX ?? down.x,
        y: overrides.absoluteY ?? down.y,
      };
      raw = {
        x: overrides.translationX ?? 0,
        y: overrides.translationY ?? 0,
      };
      startRaw = raw;
      callbacks.onStart(event(overrides));
    },
    move: (delta: {
      changeX: number;
      changeY: number;
      numberOfPointers: number;
    }) => {
      raw = { x: raw.x + delta.changeX, y: raw.y + delta.changeY };
      callbacks.onUpdate(event({ numberOfPointers: delta.numberOfPointers }));
    },
    finish: (overrides: NativeEvent = {}, success = true) => {
      raw = {
        x: overrides.translationX ?? raw.x,
        y: overrides.translationY ?? raw.y,
      };
      callbacks.onFinalize(
        event({ numberOfPointers: 0, ...overrides }),
        success,
      );
      began = false;
    },
  };
}
