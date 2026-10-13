import {
  act,
  renderHook,
  waitFor,
  type RenderHookResult,
} from '@testing-library/react-native';
import { QueryClient } from '@tanstack/react-query';
import { useElectiveCreditsConfig } from '@hooks/useElectiveCreditsConfig';
import { createTestQueryClient, createWrapper } from '@root/test-utils/render';

let mockScope: string | null;
const mockPreferences = { read: jest.fn(), write: jest.fn() };
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useIdentity: () => ({ account: mockScope ? { scope: mockScope } : null }),
  useAppServices: () => ({
    preferences: mockPreferences,
    identity: {
      getSnapshot: () => ({ account: mockScope ? { scope: mockScope } : null }),
    },
  }),
}));
let client: QueryClient;
let hook: RenderHookResult<
  ReturnType<typeof useElectiveCreditsConfig>,
  unknown
>;
const config = () => hook.result.current;
const settle = () =>
  act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 5));
  });
beforeEach(async () => {
  mockScope = 'account-a';
  mockPreferences.read
    .mockReset()
    .mockImplementation(async scope =>
      scope === 'account-a'
        ? { RESTRICTED: 4, DEFINED: 8, UNIVERSAL: 6 }
        : null,
    );
  mockPreferences.write.mockReset().mockResolvedValue(undefined);
  client = createTestQueryClient();
  hook = await renderHook(() => useElectiveCreditsConfig(), {
    wrapper: createWrapper({ queryClient: client }),
  });
  await settle();
});
afterEach(() => {
  client.clear();
});

it('reads and writes preferences for the current account only', async () => {
  expect(config().config.UNIVERSAL).toBe(6);
  mockScope = 'account-b';
  await hook.rerender(undefined);
  await settle();
  expect(config().config.UNIVERSAL).toBe(0);
  const saved = await act(() => config().updateCredits('UNIVERSAL', 8));
  expect(saved).toBe(true);
  expect(mockPreferences.write).toHaveBeenCalledWith(
    'account-b',
    'elective-credits',
    { RESTRICTED: 0, DEFINED: 0, UNIVERSAL: 8 },
  );
  await waitFor(() => expect(config().config.UNIVERSAL).toBe(8));
});

it('does not repopulate a removed account cache after a late storage write', async () => {
  let completeWrite!: () => void;
  mockPreferences.write.mockImplementation(
    () =>
      new Promise<void>(resolve => {
        completeWrite = resolve;
      }),
  );
  const pending = config().updateCredits('UNIVERSAL', 9);
  mockScope = null;
  client.removeQueries({ queryKey: ['preferences', 'account-a'] });
  completeWrite();
  await expect(pending).resolves.toBe(false);
  expect(
    client.getQueryData(['preferences', 'account-a', 'elective-credits']),
  ).toBeUndefined();
});

it('reports a failed persistence write instead of pretending the form was saved', async () => {
  mockPreferences.write.mockRejectedValue(new Error('disk full'));
  await expect(config().updateCredits('UNIVERSAL', 9)).resolves.toBe(false);
  expect(config().config.UNIVERSAL).toBe(6);
});
