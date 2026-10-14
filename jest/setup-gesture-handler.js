/* global jest */
// Capture native gesture callbacks without loading RNGH's native/Fabric module.
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View, ScrollView, FlatList, TextInput } = require('react-native');
  const createGesture = type => {
    const gesture = { type, callbacks: {}, minDistance: () => gesture };
    for (const method of [
      'onBegin',
      'onStart',
      'onChange',
      'onUpdate',
      'onFinalize',
    ]) {
      gesture[method] = callback => {
        gesture.callbacks[method] = callback;
        return gesture;
      };
    }
    return gesture;
  };
  return {
    Gesture: {
      Pan: () => createGesture('Pan'),
      Pinch: () => createGesture('Pinch'),
      Simultaneous: (...gestures) => ({ type: 'Simultaneous', gestures }),
    },
    GestureDetector: ({ gesture, children }) =>
      React.createElement(
        View,
        { gesture, testID: 'mock-gesture-detector' },
        children,
      ),
    GestureHandlerRootView: View,
    ScrollView,
    FlatList,
    TextInput,
  };
});
