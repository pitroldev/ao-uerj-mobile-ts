import {
  act,
  renderHook,
  waitFor,
  type RenderHookResult,
} from '@testing-library/react-native';
import { onlineManager, type QueryClient } from '@tanstack/react-query';

import type { PreferencesStore } from '@root/modules/identity/application/PreferencesStore';
import { createTestQueryClient, createWrapper } from '@root/test-utils/render';
import { AttendanceRecords } from '../../application/AttendanceRecords';
import { useAttendance } from '../useAttendance';

let mockAccount: { scope: string; period: string } | null;
const mockData = new Map<string, unknown>();
const mockStore: PreferencesStore = {
  read: async <T,>(scope: string, key: string) =>
    (mockData.get(`${scope}:${key}`) as T | undefined) ?? null,
  write: jest.fn(async (scope: string, key: string, value: unknown) => {
    mockData.set(`${scope}:${key}`, JSON.parse(JSON.stringify(value)));
  }),
  update: jest.fn(
    async <T,>(
      scope: string,
      key: string,
      change: (current: T | null) => T,
    ) => {
      const next = change(
        (mockData.get(`${scope}:${key}`) as T | undefined) ?? null,
      );
      mockData.set(`${scope}:${key}`, JSON.parse(JSON.stringify(next)));
      return next;
    },
  ),
  remove: async (scope: string, key: string) => {
    mockData.delete(`${scope}:${key}`);
  },
};
const mockAttendance = new AttendanceRecords(mockStore);
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useIdentity: () => ({ account: mockAccount }),
  useAppServices: () => ({
    attendance: mockAttendance,
    identity: { getSnapshot: () => ({ account: mockAccount }) },
  }),
}));

const meeting = (date: string) => ({
  subjectId: '778',
  date,
  start: 860,
  end: 960,
  slots: 2,
});

let client: QueryClient;
let hook: RenderHookResult<ReturnType<typeof useAttendance>, unknown>;
const current = () => hook.result.current;

beforeEach(async () => {
  mockData.clear();
  mockAccount = { scope: 'account-a', period: '2026.1' };
  client = createTestQueryClient();
  hook = await renderHook(() => useAttendance(), {
    wrapper: createWrapper({ queryClient: client }),
  });
});
afterEach(() => {
  client.clear();
});

it('marks and unmarks absences of the current account and period', async () => {
  expect(current().absences).toEqual([]);
  const saved = await act(() => current().mark(meeting('2026-10-15'), true));
  expect(saved).toBe(true);
  await waitFor(() =>
    expect(current().keys.has('778@2026-10-15@860')).toBe(true),
  );
  expect(current().absences).toHaveLength(1);

  await act(() => current().mark(meeting('2026-10-15'), false));
  await waitFor(() => expect(current().absences).toEqual([]));
});

it('keeps each account and period apart', async () => {
  await act(() => current().mark(meeting('2026-10-15'), true));
  mockAccount = { scope: 'account-b', period: '2026.1' };
  await hook.rerender(undefined);
  await waitFor(() => expect(current().absences).toEqual([]));

  mockAccount = { scope: 'account-a', period: '2026.2' };
  await hook.rerender(undefined);
  await waitFor(() => expect(current().absences).toEqual([]));

  mockAccount = { scope: 'account-a', period: '2026.1' };
  await hook.rerender(undefined);
  await waitFor(() => expect(current().absences).toHaveLength(1));
});

it('reports a failed write and saves nothing signed out', async () => {
  jest.mocked(mockStore.update).mockRejectedValueOnce(new Error('disk'));
  expect(await act(() => current().mark(meeting('2026-10-15'), true))).toBe(
    false,
  );
  expect(current().absences).toEqual([]);

  mockAccount = null;
  await hook.rerender(undefined);
  expect(await act(() => current().mark(meeting('2026-10-15'), true))).toBe(
    false,
  );
});

it('reads the absences saved on the device without a connection', async () => {
  await act(() => current().mark(meeting('2026-10-15'), true));
  client.clear();
  onlineManager.setOnline(false);
  try {
    const offline = await renderHook(() => useAttendance(), {
      wrapper: createWrapper({ queryClient: client }),
    });
    await waitFor(() =>
      expect(offline.result.current.keys.has('778@2026-10-15@860')).toBe(true),
    );
  } finally {
    onlineManager.setOnline(true);
  }
});
