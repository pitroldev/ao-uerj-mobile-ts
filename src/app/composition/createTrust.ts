import { AppState } from 'react-native';

import { createNativeDeviceTrust } from '@root/adapters/outbound/native/NativeDeviceTrust';
import { createTokenStore } from '@root/adapters/outbound/persistence/token-store';
import type { SecureVault } from '@root/adapters/outbound/persistence/vault-storage';
import type { PrivateApiHttpClient } from '@root/adapters/outbound/private-api';
import { createTokenIssuer } from '@root/adapters/outbound/private-api/tokens';
import type { RemoteStatus } from '@root/modules/delivery/application/RemoteStatus';
import type { IdentityController } from '@root/modules/identity/application/IdentityController';
import { PrivateTokens } from '@root/modules/trust/application/PrivateTokens';
import type { DeviceTrustPort } from '@root/modules/trust/application/ports';

/** A espera ao acaso entre a entrada no app e o pedido de tokens. */
const REFILL_DELAY_MS = { min: 20_000, max: 120_000 };

type Dependencies = {
  identity: Pick<IdentityController, 'getSnapshot' | 'subscribe'>;
  remoteStatus: Pick<RemoteStatus, 'getSnapshot'>;
  vault: SecureVault | null;
  client: PrivateApiHttpClient;
  device?: DeviceTrustPort | null;
  random?: () => number;
};

/**
 * Tokens anônimos de aluno. O app só pede tokens com o login confirmado no
 * Aluno Online nesta sessão: com o app na frente, um tempo ao acaso depois
 * da entrada; em segundo plano, na verificação de avisos (portalCheckTask).
 * O logout apaga o estoque.
 */
export function createTrust({
  identity,
  remoteStatus,
  vault,
  client,
  device = createNativeDeviceTrust(),
  random = Math.random,
}: Dependencies) {
  const tokens = new PrivateTokens({
    issuer: createTokenIssuer(client),
    device,
    store: vault ? createTokenStore(vault) : null,
    allowedKeys: () => remoteStatus.getSnapshot().status?.tokenKeys ?? null,
    now: () => Date.now(),
  });
  if (!device || !vault) return tokens;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let previous = identity.getSnapshot().status;
  identity.subscribe(() => {
    const { status, error } = identity.getSnapshot();
    if (status === 'signedOut') {
      if (timer) clearTimeout(timer);
      timer = null;
      if (previous !== 'signedOut') void tokens.clear().catch(() => undefined);
    } else if (
      status === 'signedIn' &&
      !error &&
      AppState.currentState === 'active' &&
      !timer
    ) {
      const delay =
        REFILL_DELAY_MS.min +
        random() * (REFILL_DELAY_MS.max - REFILL_DELAY_MS.min);
      timer = setTimeout(() => {
        timer = null;
        void tokens.refill();
      }, delay);
    }
    previous = status;
  });
  return tokens;
}
