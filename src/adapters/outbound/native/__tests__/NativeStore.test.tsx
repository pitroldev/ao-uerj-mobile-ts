import { Linking } from 'react-native';
import InAppReview from 'react-native-in-app-review';
import { nativeReviewPrompt, storeListingFor } from '../NativeStore';

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
  const play = storeListingFor('android');
  expect(play).toMatchObject({ available: true, name: 'Play Store' });
  const openURL = jest.mocked(Linking.openURL);
  await play.open();
  expect(openURL).toHaveBeenLastCalledWith(
    'market://details?id=com.aouerjmobile',
  );
  openURL.mockRejectedValueOnce(new Error('No Activity found'));
  await play.open();
  expect(openURL).toHaveBeenLastCalledWith(
    'https://play.google.com/store/apps/details?id=com.aouerjmobile',
  );
});

it('opens the App Store app on the iPhone and falls back to the website without it', async () => {
  const appStore = storeListingFor('ios');
  expect(appStore).toMatchObject({ available: true, name: 'App Store' });
  const openURL = jest.mocked(Linking.openURL);
  await appStore.open();
  expect(openURL).toHaveBeenLastCalledWith(
    'itms-apps://apps.apple.com/br/app/id6835308883',
  );
  openURL.mockRejectedValueOnce(new Error('simulador sem App Store'));
  await appStore.open();
  expect(openURL).toHaveBeenLastCalledWith(
    'https://apps.apple.com/br/app/id6835308883',
  );
});
