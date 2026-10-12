import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { useGenerateSchedules } from '../useGenerateSchedules';
import { form, generated } from '../../application/testFixtures';

const mockGenerate = jest.fn();
let mockScope = 'account-a';
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useIdentity: () => ({ account: { scope: mockScope } }),
  useAppServices: () => ({
    scheduleGenerator: { generate: mockGenerate },
    identity: { getSnapshot: () => ({ account: { scope: mockScope } }) },
  }),
}));

let mutation: ReturnType<typeof useGenerateSchedules>;
function Probe() {
  mutation = useGenerateSchedules();
  return <>{mutation.status}</>;
}
let renderer: ReactTestRenderer;
let client: QueryClient;
const settle = () =>
  act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 5));
  });
beforeEach(async () => {
  mockScope = 'account-a';
  mockGenerate.mockReset().mockResolvedValue([generated]);
  client = new QueryClient({
    defaultOptions: { mutations: { gcTime: Infinity } },
  });
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  client.clear();
});

it('generates only on an explicit command and never on mount, render or refocus', async () => {
  expect(mockGenerate).not.toHaveBeenCalled();
  await act(async () => {
    mutation.mutate(form);
  });
  await settle();
  expect(mutation.data).toEqual([generated]);
  await act(async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    renderer.update(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  await settle();
  expect(mockGenerate).toHaveBeenCalledTimes(1);
});

it('does not retry a failed generation until explicitly requested', async () => {
  mockGenerate.mockRejectedValue(new Error('unavailable'));
  await act(async () => {
    mutation.mutate(form);
  });
  await settle();
  expect(mutation.isError).toBe(true);
  expect(mockGenerate).toHaveBeenCalledTimes(1);
});

it('aborts work when leaving the flow and discards a late response', async () => {
  let resolveLate!: (value: (typeof generated)[]) => void;
  let signal!: AbortSignal;
  mockGenerate.mockImplementation(
    (_request, options: { signal: AbortSignal }) => {
      signal = options.signal;
      return new Promise(resolve => {
        resolveLate = resolve;
      });
    },
  );
  let pending!: Promise<unknown>;
  await act(async () => {
    pending = mutation.mutateAsync(form);
  });
  await act(async () => {
    renderer.unmount();
  });
  expect(signal.aborted).toBe(true);
  resolveLate([generated]);
  await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
});
