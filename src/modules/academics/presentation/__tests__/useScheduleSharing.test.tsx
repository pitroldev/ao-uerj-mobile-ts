import React from 'react';
import { View, StyleSheet } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { useScheduleSharing } from '../useScheduleSharing';

const mockCapturePng = jest.fn();
const mockShare = jest.fn();
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({
    scheduleSharing: { capturePng: mockCapturePng, share: mockShare },
  }),
}));
jest.mock('react-native-svg', () => ({ SvgXml: 'SvgXml' }));
let sharing: ReturnType<typeof useScheduleSharing>;
function Probe() {
  sharing = useScheduleSharing();
  return <sharing.SvgRenderer svgString='<svg width="100" height="100" />' />;
}
let renderer: ReactTestRenderer;
beforeEach(async () => {
  mockCapturePng.mockReset().mockResolvedValue('file:///schedule.png');
  mockShare.mockReset().mockResolvedValue(undefined);
  await act(async () => {
    renderer = create(<Probe />, {
      createNodeMock: () => ({ nativeView: true }),
    });
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});

it('keeps the capture view native and opaque and waits for a measured layout', async () => {
  const view = renderer.root.findByType(View);
  expect(view.props.collapsable).toBe(false);
  expect(StyleSheet.flatten(view.props.style).opacity).not.toBe(0);
  await act(async () => {
    await sharing.share('svg-before-layout');
  });
  expect(mockCapturePng).not.toHaveBeenCalled();
  expect(mockShare).toHaveBeenCalledWith({
    url: 'svg-before-layout',
    type: 'image/svg+xml',
  });
  await act(async () => {
    view.props.onLayout({
      nativeEvent: { layout: { width: 100, height: 100 } },
    });
    await sharing.share('svg-after-layout');
  });
  expect(mockCapturePng).toHaveBeenCalledTimes(1);
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
  await act(async () => {
    first = sharing.share('svg');
    second = sharing.share('svg');
  });
  expect(mockShare).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolveDialog();
    await Promise.all([first, second]);
  });
});
