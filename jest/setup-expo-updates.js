/* global jest */
// O expo-updates lê o módulo nativo ao carregar, e ele não existe nos testes:
// o app roda o JS da instalação, sem atualização OTA, como no debug.
jest.mock('expo-updates', () => ({
  isEnabled: false,
  isEmbeddedLaunch: true,
  updateId: null,
  createdAt: null,
}));
