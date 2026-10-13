/* global jest */
// O Reanimated depende do runtime de worklets, que não existe nos testes. O
// app só o usa para acompanhar o teclado (ScreenPanel), e o mock da
// react-native-keyboard-controller já entrega valores fixos: aqui basta uma
// View comum e um estilo calculado na hora.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useAnimatedStyle: updater => updater(),
  };
});
