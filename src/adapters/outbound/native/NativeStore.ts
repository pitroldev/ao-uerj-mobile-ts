import { Linking, Platform } from 'react-native';
import InAppReview from 'react-native-in-app-review';
import type {
  ReviewPromptPort,
  StoreListingPort,
} from '@root/modules/delivery/application/ports';
import {
  APP_STORE_ID,
  APP_STORE_LISTING_URL,
  PLAY_LISTING_URL,
} from '@root/modules/delivery/domain/invite';

const PACKAGE = 'com.aouerjmobile';

/** Play In-App Review (Android) e SKStoreReviewController (iOS). */
export const nativeReviewPrompt: ReviewPromptPort = {
  isAvailable: () => InAppReview.isAvailable(),
  async request() {
    await InAppReview.RequestInAppReview();
  },
};

/** O app da loja ou, sem ele (emulador, simulador), o site. */
async function openStore(app: string, site: string) {
  try {
    await Linking.openURL(app);
  } catch {
    await Linking.openURL(site);
  }
}

const PLAY_STORE: StoreListingPort = {
  available: true,
  name: 'Play Store',
  open: () => openStore(`market://details?id=${PACKAGE}`, PLAY_LISTING_URL),
};

const APP_STORE: StoreListingPort = {
  available: true,
  name: 'App Store',
  open: () =>
    openStore(
      `itms-apps://apps.apple.com/br/app/id${APP_STORE_ID}`,
      APP_STORE_LISTING_URL,
    ),
};

/** A página do app na loja do sistema: a Play no Android, a App Store no iOS. */
export const storeListingFor = (os: typeof Platform.OS): StoreListingPort =>
  os === 'ios' ? APP_STORE : PLAY_STORE;

export const nativeStoreListing = storeListingFor(Platform.OS);
