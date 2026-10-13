/* global jest */
// react-native-keyboard-controller depende de módulo nativo e do Reanimated:
// nos testes vale o mock oficial da lib (KeyboardProvider vira um host
// simples, KeyboardAvoidingView e KeyboardStickyView viram View e o
// KeyboardAwareScrollView vira ScrollView).
jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);
