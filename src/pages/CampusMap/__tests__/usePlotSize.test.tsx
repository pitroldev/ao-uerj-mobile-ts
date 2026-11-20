import type { LayoutChangeEvent } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { usePlotSize } from '../usePlotSize';

const layout = (width: number, height: number) =>
  ({ nativeEvent: { layout: { width, height } } }) as LayoutChangeEvent;
/** A view do Fabric: a medida síncrona e o layout sem transformações. */
const view = (
  rect: { width: number; height: number },
  offset = { width: Math.round(rect.width), height: Math.round(rect.height) },
) => ({
  getBoundingClientRect: () => rect,
  offsetWidth: offset.width,
  offsetHeight: offset.height,
});
/** O teclado na tela (ou descendo), como o `KeyboardProvider` informa. */
const keyboard = (visible: boolean) =>
  jest
    .mocked(useKeyboardState)
    .mockImplementation(((
      selector?: (state: { isVisible: boolean }) => unknown,
    ) =>
      selector
        ? selector({ isVisible: visible })
        : { isVisible: visible }) as typeof useKeyboardState);

beforeEach(() => {
  jest.useFakeTimers();
  keyboard(false);
});
afterEach(() => jest.useRealTimers());

it('has no size until the area is laid out, then takes the first measure at once', async () => {
  const { result } = await renderHook(() => usePlotSize());
  expect(result.current[1]).toBeNull();

  await act(() => result.current[2](layout(0, 0)));
  expect(result.current[1]).toBeNull();

  await act(() => result.current[2](layout(412, 540)));
  expect(result.current[1]).toEqual({ width: 412, height: 540 });
});

it('keeps the same size object for the same measure', async () => {
  const { result } = await renderHook(() => usePlotSize());
  await act(() => result.current[2](layout(392.727, 540)));
  const size = result.current[1];
  // o mesmo layout de novo, ou a menos de meio dp: nada a redesenhar
  await act(() => {
    result.current[2](layout(392.727, 540.3));
    jest.advanceTimersByTime(200);
  });
  expect(result.current[1]).toBe(size);
});

it('takes only the last of a run of layout changes', async () => {
  const { result } = await renderHook(() => usePlotSize());
  await act(() => result.current[2](layout(412, 300)));
  const first = result.current[1];
  // o painel acompanha uma animação: uma medida por quadro
  await act(() => {
    for (let height = 310; height <= 540; height += 10) {
      result.current[2](layout(412, height));
      jest.advanceTimersByTime(16);
    }
  });
  expect(result.current[1]).toBe(first);
  await act(() => jest.advanceTimersByTime(100));
  expect(result.current[1]).toEqual({ width: 412, height: 540 });
});

it('waits for the keyboard to leave before the first measure', async () => {
  // quem escolhe um resultado da busca monta o mapa com o teclado descendo
  keyboard(true);
  const { result, rerender } = await renderHook(() => usePlotSize());
  await act(() => {
    for (let height = 180; height <= 540; height += 40) {
      result.current[2](layout(412, height));
      jest.advanceTimersByTime(16);
    }
    jest.advanceTimersByTime(200);
  });
  // nada de desenhar pequeno e refazer a cada quadro
  expect(result.current[1]).toBeNull();

  keyboard(false);
  await rerender(undefined);
  expect(result.current[1]).toEqual({ width: 412, height: 540 });
});

it('does not wait forever for a keyboard that stays', async () => {
  keyboard(true);
  const { result } = await renderHook(() => usePlotSize());
  await act(() => result.current[2](layout(412, 300)));
  expect(result.current[1]).toBeNull();
  await act(() => jest.advanceTimersByTime(1300));
  expect(result.current[1]).toEqual({ width: 412, height: 300 });
});

it('measures in the layout effect, before the first paint, where Fabric allows', async () => {
  const { result, rerender } = await renderHook(() => usePlotSize());
  // o ref que a view recebe no aparelho
  (result.current[0] as { current: unknown }).current = view({
    width: 392.727,
    height: 512.5,
  });
  await rerender(undefined);
  expect(result.current[1]).toEqual({ width: 392.727, height: 512.5 });

  // o rodapé cresceu no mesmo commit: a medida nova sai sem esperar o evento
  (result.current[0] as { current: unknown }).current = view({
    width: 392.727,
    height: 448,
  });
  await rerender(undefined);
  expect(result.current[1]).toEqual({ width: 392.727, height: 448 });
});

it('ignores a measure taken under a scaled ancestor', async () => {
  const { result, rerender } = await renderHook(() => usePlotSize());
  await act(() => result.current[2](layout(392, 512)));
  // no meio de uma transição com escala, a medida síncrona não é o layout
  (result.current[0] as { current: unknown }).current = view(
    { width: 352.8, height: 460.8 },
    { width: 392, height: 512 },
  );
  await rerender(undefined);
  expect(result.current[1]).toEqual({ width: 392, height: 512 });
});
