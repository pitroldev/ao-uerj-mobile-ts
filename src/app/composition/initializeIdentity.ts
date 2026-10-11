import type { IdentityController } from '@root/modules/identity/application/IdentityController';
import { errorMessage } from '@root/shared/errors/AppError';

/** Migration is a startup gate: an unverified transfer must never be restored. */
export async function initializeIdentity(
  migrate: () => Promise<void>,
  identity: Pick<IdentityController, 'restore' | 'signOut'>,
): Promise<string | null> {
  try {
    await migrate();
  } catch (error) {
    await identity.signOut().catch(() => undefined);
    return errorMessage(error);
  }
  await identity.restore();
  return null;
}
