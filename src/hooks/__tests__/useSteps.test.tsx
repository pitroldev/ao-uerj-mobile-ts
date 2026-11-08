import { act, renderHook } from '@testing-library/react-native';
import { useSteps } from '../useSteps';

it('bounds every navigation event and handles repeated taps in one render', async () => {
  const { result } = await renderHook(() =>
    useSteps({ initialStep: -4, maxStep: 2 }),
  );
  expect(result.current.step).toBe(0);
  await act(() => {
    result.current.nextStep();
    result.current.nextStep();
    result.current.nextStep();
  });
  expect(result.current.step).toBe(2);
  await act(() => result.current.setStep(100));
  expect(result.current.step).toBe(2);
  await act(() => result.current.setStep(1.5));
  expect(result.current.step).toBe(1);
  await act(() => result.current.setStep(NaN));
  expect(result.current.step).toBe(0);
  await act(() => result.current.prevStep());
  expect(result.current.step).toBe(0);
});

it('forgets an out-of-range step when the available steps shrink', async () => {
  const { result, rerender } = await renderHook(
    ({ maxStep }: { maxStep: number }) => useSteps({ initialStep: 5, maxStep }),
    { initialProps: { maxStep: 6 } },
  );
  await rerender({ maxStep: 2 });
  expect(result.current.step).toBe(2);
  await rerender({ maxStep: 6 });
  expect(result.current.step).toBe(2);
});
