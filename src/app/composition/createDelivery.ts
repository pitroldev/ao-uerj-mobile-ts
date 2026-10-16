import { createAppKeyValueStore } from '@root/adapters/outbound/delivery/appStore';
import { createRemoteAppStatusSource } from '@root/adapters/outbound/delivery/remoteAppStatus';
import { createNativeAppUpdates } from '@root/adapters/outbound/native/NativeAppUpdates';
import {
  nativeReviewPrompt,
  nativeStoreListing,
} from '@root/adapters/outbound/native/NativeStore';
import { AppUpdates } from '@root/modules/delivery/application/AppUpdates';
import { RemoteStatus } from '@root/modules/delivery/application/RemoteStatus';
import { ReviewPrompter } from '@root/modules/delivery/application/ReviewPrompter';
import type { IdentityController } from '@root/modules/identity/application/IdentityController';
import type { PreferencesStore } from '@root/modules/identity/application/PreferencesStore';

/**
 * Entrega: aviso remoto, atualização pela loja e pedido de avaliação. Usa as
 * preferências globais: valem para o app, não para a conta.
 */
export function createDelivery({
  appVersion,
  preferences,
  identity,
}: {
  appVersion: string;
  preferences: PreferencesStore;
  identity: IdentityController;
}) {
  const store = createAppKeyValueStore(preferences);
  const now = () => Date.now();
  const review = new ReviewPrompter({ review: nativeReviewPrompt, store, now });
  identity.subscribe(() => {
    if (identity.getSnapshot().status === 'signedIn') void review.noteSession();
  });
  return {
    appVersion,
    status: new RemoteStatus({
      source: createRemoteAppStatusSource(),
      store,
      now,
    }),
    updates: new AppUpdates({
      updates: createNativeAppUpdates(),
      storeListing: nativeStoreListing,
      store,
      now,
    }),
    review,
  };
}
