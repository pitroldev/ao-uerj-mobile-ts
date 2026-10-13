/* global jest */
// O SDK do Sentry inicializa módulos nativos e instala handlers globais. Nos
// testes, só as funções que o app chama, registrando as chamadas; as opções de
// init (beforeSend etc.) são testadas a partir do que chega em `init`.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(() => 'evento-de-teste'),
  captureFeedback: jest.fn(() => 'feedback-de-teste'),
  addBreadcrumb: jest.fn(),
  breadcrumbsIntegration: jest.fn(options => ({
    name: 'Breadcrumbs',
    options,
  })),
}));
