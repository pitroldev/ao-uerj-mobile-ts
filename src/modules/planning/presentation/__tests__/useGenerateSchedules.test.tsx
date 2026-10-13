import { act, renderHook, waitFor } from '@testing-library/react-native';
import { focusManager, type QueryClient } from '@tanstack/react-query';
import { createTestQueryClient, createWrapper } from '@root/test-utils/render';
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

let client: QueryClient;
const renderGeneration = () =>
  renderHook(() => useGenerateSchedules(), {
    wrapper: createWrapper({ queryClient: client }),
  });
/** Dá tempo a uma geração indevida (foco, novo render) de acontecer. */
const settle = () =>
  act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 5));
  });
beforeEach(() => {
  mockScope = 'account-a';
  mockGenerate.mockReset().mockResolvedValue([generated]);
  client = createTestQueryClient();
});
afterEach(() => {
  client.clear();
});

it('generates only on an explicit command and never on mount, render or refocus', async () => {
  const { result, rerender } = await renderGeneration();
  expect(mockGenerate).not.toHaveBeenCalled();
  await act(() => {
    result.current.mutate(form);
  });
  await waitFor(() => expect(result.current.data).toEqual([generated]));
  await act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
  await rerender(undefined);
  await settle();
  expect(mockGenerate).toHaveBeenCalledTimes(1);
});

it('does not retry a failed generation until explicitly requested', async () => {
  mockGenerate.mockRejectedValue(new Error('unavailable'));
  const { result } = await renderGeneration();
  await act(() => {
    result.current.mutate(form);
  });
  await waitFor(() => expect(result.current.isError).toBe(true));
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
  const { result, unmount } = await renderGeneration();
  let pending!: Promise<unknown>;
  await act(() => {
    pending = result.current.mutateAsync(form);
  });
  await unmount();
  expect(signal.aborted).toBe(true);
  resolveLate([generated]);
  await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
});
