import Share from 'react-native-share';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import { NativeScheduleSharing } from '../NativeScheduleSharing';

jest.mock('react-native-share', () => ({
  __esModule: true,
  default: { open: jest.fn() },
}));
jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(),
  releaseCapture: jest.fn(),
}));

const nativeSharing = new NativeScheduleSharing();

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(captureRef).mockResolvedValue('file:///cache/horario.png');
  jest
    .mocked(Share.open)
    .mockResolvedValue({ success: true, message: 'local-receiver' });
});

it('captures PNG bytes and keeps the native file URI intact', async () => {
  const target = { nativeView: true };
  await expect(nativeSharing.capturePng(target)).resolves.toBe(
    'file:///cache/horario.png',
  );
  expect(captureRef).toHaveBeenCalledWith(target, {
    format: 'png',
    quality: 1,
  });
});

it('passes the PNG MIME and file URI to the native share provider', async () => {
  await nativeSharing.share({
    url: 'file:///cache/horario.png',
    type: 'image/png',
  });
  expect(Share.open).toHaveBeenCalledWith({
    url: 'file:///cache/horario.png',
    type: 'image/png',
    failOnCancel: false,
  });
});

it('does not remove the temporary PNG when the chooser resolves before the receiver reads it', async () => {
  const url = await nativeSharing.capturePng({ nativeView: true });
  await nativeSharing.share({ url, type: 'image/png' });
  // Android resolves the chooser on target selection, before that app opens
  // the granted content URI. View-shot owns cleanup after the source app exits.
  expect(releaseCapture).not.toHaveBeenCalled();
});

it('preserves the SVG MIME on fallback and propagates native share failures', async () => {
  const image = {
    url: 'data:image/svg+xml;base64,PHN2Zy8+',
    type: 'image/svg+xml',
  } as const;
  const failure = new Error('No compatible receiver');
  jest.mocked(Share.open).mockRejectedValueOnce(failure);
  await expect(nativeSharing.share(image)).rejects.toBe(failure);
  expect(Share.open).toHaveBeenCalledWith({ ...image, failOnCancel: false });
});
