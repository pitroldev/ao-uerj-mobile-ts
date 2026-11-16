import { createCompanionStore } from '@root/adapters/outbound/persistence/companion-store';
import type { SecureVault } from '@root/adapters/outbound/persistence/vault-storage';
import { CompanionCalls } from '@root/modules/companion/application/CompanionCalls';
import type { CompanionServerPort } from '@root/modules/companion/application/ports';
import type { StudentSession } from '@root/modules/trust/application/StudentSession';

type Dependencies = {
  /** O servidor da Companhia (cada pedido leva a sessão de aluno). */
  server: CompanionServerPort;
  session: Pick<StudentSession, 'supported'>;
  vault: SecureVault | null;
};

/**
 * A Companhia agora: só onde o app entra como aluno (Play ou App Attest) e
 * guarda as chaves de membro (o cofre). Cada pedido leva a sessão, e o
 * servidor sabe quem está em cada mesa ou grupo. No logout, a composição
 * chama `clear` antes de encerrar a sessão (ver `followIdentity`).
 */
export function createCompanion({ server, session, vault }: Dependencies) {
  return new CompanionCalls({
    server,
    store: vault && session.supported ? createCompanionStore(vault) : null,
    now: () => Date.now(),
  });
}
