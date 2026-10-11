import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useElectiveCreditsConfig } from '@hooks/useElectiveCreditsConfig';

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
let config: ReturnType<typeof useElectiveCreditsConfig>;
function Probe() {
  config = useElectiveCreditsConfig();
  return <>{JSON.stringify(config.config)}</>;
}
let client: QueryClient;
let renderer: ReactTestRenderer;
const settle = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 5));
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
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  await settle();
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  client.clear();
});

it('reads and writes preferences for the current account only', async () => {
  expect(config.config.UNIVERSAL).toBe(6);
  mockScope = 'account-b';
  await act(async () => {
    renderer.update(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  await settle();
  expect(config.config.UNIVERSAL).toBe(0);
  await act(async () => {
    expect(await config.updateCredits('UNIVERSAL', 8)).toBe(true);
  });
  expect(mockPreferences.write).toHaveBeenCalledWith(
    'account-b',
    'elective-credits',
    { RESTRICTED: 0, DEFINED: 0, UNIVERSAL: 8 },
  );
});

it('does not repopulate a removed account cache after a late storage write', async () => {
  let completeWrite!: () => void;
  mockPreferences.write.mockImplementation(
    () =>
      new Promise<void>(resolve => {
        completeWrite = resolve;
      }),
  );
  const pending = config.updateCredits('UNIVERSAL', 9);
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
  await expect(config.updateCredits('UNIVERSAL', 9)).resolves.toBe(false);
  expect(config.config.UNIVERSAL).toBe(6);
});
