import { act, renderHook } from '@testing-library/react-native';

import { useDelayedMoment, useMomentOnLeave } from '../positiveMoments';

const mockMoment = jest.fn();
jest.mock('../DeliveryProvider', () => ({
  usePositiveMoment: () => mockMoment,
}));
// sair da tela é desmontar: o efeito de foco vira um efeito comum
jest.mock('@react-navigation/native', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('counts the choice only when the student leaves the screen', async () => {
  const { result, unmount } = await renderHook(() => useMomentOnLeave());
  await act(() => result.current());
  await act(() => result.current());
  expect(mockMoment).not.toHaveBeenCalled();
  await unmount();
  expect(mockMoment).toHaveBeenCalledTimes(1);
});

it('does not count leaving without a choice', async () => {
  const { unmount } = await renderHook(() => useMomentOnLeave());
  await unmount();
  expect(mockMoment).not.toHaveBeenCalled();
});

it('counts a moment a little later, once, and not after leaving', async () => {
  const { result, unmount } = await renderHook(() => useDelayedMoment(2_500));
  await act(() => {
    result.current();
    result.current();
  });
  expect(mockMoment).not.toHaveBeenCalled();
  await act(() => jest.advanceTimersByTime(2_500));
  expect(mockMoment).toHaveBeenCalledTimes(1);

  await act(() => result.current());
  await unmount();
  await act(() => jest.advanceTimersByTime(5_000));
  expect(mockMoment).toHaveBeenCalledTimes(1);
});
