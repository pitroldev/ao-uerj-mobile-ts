import { readRunningUpdate, type UpdatesConstants } from '../runningUpdate';

const published = new Date('2026-11-06T21:30:00Z');

function updates(overrides: Partial<UpdatesConstants>): UpdatesConstants {
  return {
    isEnabled: true,
    isEmbeddedLaunch: false,
    updateId: '0c2d6a4e-5b1f-4d7e-9a8b-3f2e1d0c9b8a',
    createdAt: published,
    ...overrides,
  };
}

it('reads the OTA update the app launched', () => {
  expect(readRunningUpdate(updates({}))).toEqual({
    id: '0c2d6a4e-5b1f-4d7e-9a8b-3f2e1d0c9b8a',
    createdAt: published,
  });
});

it('reports no update with the JS of the installation', () => {
  // o pacote da instalação também tem id e data (os do build)
  expect(readRunningUpdate(updates({ isEmbeddedLaunch: true }))).toBeNull();
});

it('reports no update while expo-updates is off (debug, Metro)', () => {
  expect(
    readRunningUpdate(
      updates({ isEnabled: false, updateId: null, createdAt: null }),
    ),
  ).toBeNull();
});

it('reports no update when the native side gives no id or date', () => {
  expect(readRunningUpdate(updates({ updateId: null }))).toBeNull();
  expect(readRunningUpdate(updates({ createdAt: null }))).toBeNull();
});

it('falls back to the mocked module in tests: the JS of the installation', () => {
  expect(readRunningUpdate()).toBeNull();
});
