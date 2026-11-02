import type { AppAttester } from '../../../modules/access/ports.ts';

/**
 * Para o emulador e os builds de debug, que nunca passam na Play Integrity:
 * aceita qualquer atestação. A configuração o recusa em produção
 * (`TOKEN_ATTESTATION=development`), e a partida avisa no log.
 */
export const createDevelopmentAttester = (): AppAttester => ({
  verify: async () => ({ trusted: true }),
});
