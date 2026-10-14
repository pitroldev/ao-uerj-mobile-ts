/* global jest */
// Shared values persist across React renders, while animated styles read their
// latest values independently of React (as gesture frames do on the device).
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  const animatedValue = updater =>
    new Proxy(
      {},
      {
        get: (_target, key) => updater()[key],
        ownKeys: () => Reflect.ownKeys(updater()),
        getOwnPropertyDescriptor: () => ({
          configurable: true,
          enumerable: true,
        }),
      },
    );
  return {
    __esModule: true,
    default: { View },
    useAnimatedStyle: animatedValue,
    useSharedValue: initial => {
      const ref = React.useRef(null);
      if (ref.current === null) {
        let value = initial;
        ref.current = {
          get: () => value,
          set: next => {
            value = typeof next === 'function' ? next(value) : next;
          },
        };
      }
      return ref.current;
    },
  };
});

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: jest.fn((callback, ...args) => callback(...args)),
}));
