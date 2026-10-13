import { Linking } from 'react-native';
import InAppReview from 'react-native-in-app-review';
import { nativeReviewPrompt, nativeStoreListing } from '../NativeStore';

jest.mock('react-native-in-app-review', () => ({
  __esModule: true,
  default: {
    isAvailable: jest.fn(() => true),
    RequestInAppReview: jest.fn(async () => true),
  },
}));

it('asks the store for the review sheet', async () => {
  expect(nativeReviewPrompt.isAvailable()).toBe(true);
  await nativeReviewPrompt.request();
  expect(InAppReview.RequestInAppReview).toHaveBeenCalled();
});

it('rejects (instead of throwing synchronously) when the native module is missing', async () => {
  jest.mocked(InAppReview.RequestInAppReview).mockImplementationOnce(() => {
    throw new Error('InAppReview native module not available');
  });
  await expect(nativeReviewPrompt.request()).rejects.toThrow(
    'native module not available',
  );
});

it('opens the Play app and falls back to the website without it', async () => {
  const openURL = jest.mocked(Linking.openURL);
  await nativeStoreListing.open();
  expect(openURL).toHaveBeenLastCalledWith(
    'market://details?id=com.aouerjmobile',
  );
  openURL.mockRejectedValueOnce(new Error('No Activity found'));
  await nativeStoreListing.open();
  expect(openURL).toHaveBeenLastCalledWith(
    'https://play.google.com/store/apps/details?id=com.aouerjmobile',
  );
});
