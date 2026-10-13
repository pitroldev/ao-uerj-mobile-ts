import { Linking, Platform } from 'react-native';
import InAppReview from 'react-native-in-app-review';
import type {
  ReviewPromptPort,
  StoreListingPort,
} from '@root/modules/delivery/application/ports';

const PACKAGE = 'com.aouerjmobile';

/** Play In-App Review (Android) e SKStoreReviewController (iOS). */
export const nativeReviewPrompt: ReviewPromptPort = {
  isAvailable: () => InAppReview.isAvailable(),
  async request() {
    await InAppReview.RequestInAppReview();
  },
};

/**
 * Página do app na Play (app da loja ou, sem ele, o site). No iOS o app não
 * está publicado: sem página para abrir.
 */
export const nativeStoreListing: StoreListingPort = {
  available: Platform.OS === 'android',
  async open() {
    try {
      await Linking.openURL(`market://details?id=${PACKAGE}`);
    } catch {
      await Linking.openURL(
        `https://play.google.com/store/apps/details?id=${PACKAGE}`,
      );
    }
  },
};
