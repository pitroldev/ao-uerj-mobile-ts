import type { IdentityState } from './types';

/**
 * A conta aparece no app: logada, renovando ou restaurada na abertura (com
 * os dados salvos, antes de o login no portal terminar).
 */
export function showsAccount(
  state: Pick<IdentityState, 'status' | 'account'>,
): boolean {
  return Boolean(state.account) && state.status !== 'signedOut';
}
