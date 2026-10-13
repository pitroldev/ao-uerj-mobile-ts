import { AppState, type AppStateStatus } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';

import { useToday } from '../useToday';

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 9, 12, 23, 58, 30) });
});
afterEach(() => {
  jest.useRealTimers();
});

it('turns to the next day at midnight and keeps the same date within the day', async () => {
  const { result } = await renderHook(() => useToday());
  const first = result.current;
  expect(first.getDate()).toBe(12);
  // 23:59:30: mesmo dia, mesmo objeto (os rótulos não recalculam)
  await act(() => jest.advanceTimersByTimeAsync(60_000));
  expect(result.current).toBe(first);
  // 00:00:01
  await act(() => jest.advanceTimersByTimeAsync(31_000));
  expect(result.current.getDate()).toBe(13);
});

it('catches up when the app returns to the foreground on another day', async () => {
  const listeners = new Set<(state: AppStateStatus) => void>();
  const subscription = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    });
  const appState = (state: AppStateStatus) =>
    act(() => listeners.forEach(listener => listener(state)));
  const { result, unmount } = await renderHook(() => useToday());
  const first = result.current;

  await appState('active');
  expect(result.current).toBe(first);
  // em segundo plano o timer da meia-noite não roda; o relógio já é outro dia
  await appState('background');
  jest.setSystemTime(new Date(2026, 9, 13, 8, 0));
  await appState('active');
  expect(result.current.getDate()).toBe(13);

  await unmount();
  expect(listeners.size).toBe(0);
  subscription.mockRestore();
});
