import React from 'react';
import { PixelRatio } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useScheduleSharing } from '../useScheduleSharing';

const mockCapturePng = jest.fn();
const mockShare = jest.fn();
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({
    scheduleSharing: { capturePng: mockCapturePng, share: mockShare },
  }),
}));
jest.mock('react-native-svg', () => ({ SvgXml: 'SvgXml' }));
// O `SvgRenderer` usa a ref criada pelo hook: ele precisa estar na mesma
// árvore do hook, como na agenda.
let sharing: ReturnType<typeof useScheduleSharing>;
function Probe() {
  sharing = useScheduleSharing();
  return <sharing.SvgRenderer svgString='<svg width="100" height="100" />' />;
}
beforeEach(async () => {
  mockCapturePng.mockReset().mockResolvedValue('file:///schedule.png');
  mockShare.mockReset().mockResolvedValue(undefined);
  await render(<Probe />);
});

it('keeps the capture view native and opaque and waits for a measured layout', async () => {
  // a vista de captura fica fora da tela e sem papel acessível: é a raiz
  const view = screen.root!;
  expect(view).toHaveProp('collapsable', false);
  expect(view).toBeVisible();
  // em dp, para a captura sair com os pixels do desenho em qualquer tela
  expect(view.children[0]).toHaveProp('width', 100 / PixelRatio.get());
  expect(view.children[0]).toHaveProp('height', 100 / PixelRatio.get());
  await act(() => sharing.share('svg-before-layout'));
  expect(mockCapturePng).not.toHaveBeenCalled();
  expect(mockShare).toHaveBeenCalledWith({
    url: 'svg-before-layout',
    type: 'image/svg+xml',
  });
  await fireEvent.layout(view, { width: 100, height: 100 });
  await act(() => sharing.share('svg-after-layout'));
  expect(mockCapturePng).toHaveBeenCalledTimes(1);
  expect(mockCapturePng).toHaveBeenCalledWith(expect.anything());
  expect(mockShare).toHaveBeenLastCalledWith({
    url: 'file:///schedule.png',
    type: 'image/png',
  });
});

it('ignores two taps within the same render while one native dialog is pending', async () => {
  let resolveDialog!: () => void;
  mockShare.mockImplementation(
    () =>
      new Promise<void>(resolve => {
        resolveDialog = resolve;
      }),
  );
  let first!: Promise<void>;
  let second!: Promise<void>;
  await act(() => {
    first = sharing.share('svg');
    second = sharing.share('svg');
  });
  expect(mockShare).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolveDialog();
    await Promise.all([first, second]);
  });
});
