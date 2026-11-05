import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createTestQueryClient, createWrapper } from '@root/test-utils/render';
import type { NoticeList } from '../../domain/campusNow';
import { useCampusNotices } from '../useCampusNow';

const LIST: NoticeList = {
  notices: [],
  helpersToday: 0,
  you: { points: 0, level: 1, levelAt: 0, nextLevelAt: 100 },
};
const mockList = jest.fn(async () => LIST);
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({
    campusNow: { supported: true, list: mockList, observe: async () => false },
  }),
  useIdentity: () => ({ account: { scope: 'conta' } }),
}));
jest.mock('@root/modules/delivery/presentation/positiveMoments', () => ({
  useDelayedMoment: () => () => undefined,
}));

/** O relógio do React Query andando, sem esperar de verdade. */
function advance(ms: number) {
  const real = Date.now();
  jest.spyOn(Date, 'now').mockReturnValue(real + ms);
}

afterEach(() => jest.restoreAllMocks());

it('looks again when the screen comes back with an old list', async () => {
  const { rerender } = await renderHook(
    ({ poll }: { poll: boolean }) => useCampusNotices({ poll }),
    {
      initialProps: { poll: true },
      wrapper: createWrapper({ queryClient: createTestQueryClient() }),
    },
  );
  await waitFor(() => expect(mockList).toHaveBeenCalledTimes(1));
  // o aluno sai da tela, e o tempo passa
  await rerender({ poll: false });
  advance(60_000);
  await act(async () => rerender({ poll: true }));
  await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
});

it('does not look again on a quick return, while the list is fresh', async () => {
  mockList.mockClear();
  const { rerender } = await renderHook(
    ({ poll }: { poll: boolean }) => useCampusNotices({ poll }),
    {
      initialProps: { poll: true },
      wrapper: createWrapper({ queryClient: createTestQueryClient() }),
    },
  );
  await waitFor(() => expect(mockList).toHaveBeenCalledTimes(1));
  await rerender({ poll: false });
  await act(async () => rerender({ poll: true }));
  expect(mockList).toHaveBeenCalledTimes(1);
});
