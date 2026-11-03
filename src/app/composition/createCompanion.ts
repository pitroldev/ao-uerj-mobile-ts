import { createCompanionStore } from '@root/adapters/outbound/persistence/companion-store';
import type { SecureVault } from '@root/adapters/outbound/persistence/vault-storage';
import type { PrivateApiHttpClient } from '@root/adapters/outbound/private-api';
import { createCompanionServer } from '@root/adapters/outbound/private-api/companion';
import { createStudentClient } from '@root/adapters/outbound/private-api/studentClient';
import { CompanionCalls } from '@root/modules/companion/application/CompanionCalls';
import type { IdentityController } from '@root/modules/identity/application/IdentityController';
import type { PrivateTokens } from '@root/modules/trust/application/PrivateTokens';

type Dependencies = {
  identity: Pick<IdentityController, 'getSnapshot' | 'subscribe'>;
  client: PrivateApiHttpClient;
  tokens: Pick<PrivateTokens, 'take' | 'supported'>;
  vault: SecureVault | null;
};

/**
 * A Companhia agora: só onde o app consegue tokens anônimos (Android com a
 * Play) e guardar as chaves de membro (o cofre). O logout sai das chamadas e
 * apaga as participações.
 */
export function createCompanion({
  identity,
  client,
  tokens,
  vault,
}: Dependencies) {
  const companion = new CompanionCalls({
    server: createCompanionServer(client, createStudentClient(client, tokens)),
    store: vault && tokens.supported ? createCompanionStore(vault) : null,
    now: () => Date.now(),
  });
  let previous = identity.getSnapshot().status;
  identity.subscribe(() => {
    const { status } = identity.getSnapshot();
    if (status === 'signedOut' && previous !== 'signedOut')
      void companion.clear().catch(() => undefined);
    previous = status;
  });
  return companion;
}
