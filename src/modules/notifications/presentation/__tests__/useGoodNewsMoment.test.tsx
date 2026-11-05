import { AppState } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';

import { useGoodNewsMoment } from '../useGoodNewsMoment';

const mockMoment = jest.fn();
const mockTake = jest.fn(async () => true);
jest.mock('@root/modules/delivery/presentation/DeliveryProvider', () => ({
  usePositiveMoment: () => mockMoment,
}));
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: () => mockServices,
}));
const mockServices = { notifications: { goodNews: { take: mockTake } } };

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('counts a good news a little after the Início appears', async () => {
  await renderHook(() => useGoodNewsMoment());
  expect(mockTake).not.toHaveBeenCalled();
  await act(() => jest.advanceTimersByTimeAsync(2_500));
  expect(mockTake).toHaveBeenCalledTimes(1);
  expect(mockMoment).toHaveBeenCalledTimes(1);
});

it('looks again when the app comes back to the front', async () => {
  const listeners: ((state: string) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _type: string,
    listener: (state: string) => void,
  ) => {
    listeners.push(listener);
    return { remove: jest.fn() };
  }) as never);
  mockTake.mockResolvedValueOnce(false);
  await renderHook(() => useGoodNewsMoment());
  await act(() => jest.advanceTimersByTimeAsync(2_500));
  expect(mockMoment).not.toHaveBeenCalled();
  await act(() => {
    listeners.forEach(listener => listener('active'));
  });
  await act(() => jest.advanceTimersByTimeAsync(2_500));
  expect(mockTake).toHaveBeenCalledTimes(2);
  expect(mockMoment).toHaveBeenCalledTimes(1);
});

it('does not count after the Início leaves', async () => {
  const { unmount } = await renderHook(() => useGoodNewsMoment());
  await unmount();
  await act(() => jest.advanceTimersByTimeAsync(5_000));
  expect(mockTake).not.toHaveBeenCalled();
});
