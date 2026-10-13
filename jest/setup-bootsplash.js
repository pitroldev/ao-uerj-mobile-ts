/* global jest */
// O splash nativo (TurboModuleRegistry.getEnforcing) não existe nos testes.
jest.mock('react-native-bootsplash', () => ({
  __esModule: true,
  default: {
    hide: jest.fn(() => Promise.resolve()),
    isVisible: jest.fn(() => false),
  },
}));
