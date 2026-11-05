// O clipboard é um módulo nativo: nos testes, o mock do próprio pacote (um
// teste ainda pode trocar por um seu com jest.mock).
jest.mock('@react-native-clipboard/clipboard', () =>
  require('@react-native-clipboard/clipboard/jest/clipboard-mock.js'),
);
