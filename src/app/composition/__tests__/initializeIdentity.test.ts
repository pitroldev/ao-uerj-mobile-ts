import { AppError } from '@root/shared/errors/AppError';
import { initializeIdentity } from '../initializeIdentity';

it('restores only after migration has successfully verified persistence', async () => {
  const events: string[] = [];
  const identity = {
    restore: jest.fn(async () => {
      events.push('restore');
    }),
    signOut: jest.fn(async () => {}),
  };
  const warning = await initializeIdentity(async () => {
    events.push('migrated');
  }, identity);
  expect(events).toEqual(['migrated', 'restore']);
  expect(warning).toBeNull();
});

it('requires an explicit new login when migration or its cleanup fails', async () => {
  const identity = {
    restore: jest.fn(async () => {}),
    signOut: jest.fn(async () => {
      throw new Error('native secret');
    }),
  };
  const warning = await initializeIdentity(async () => {
    throw new AppError('STORAGE_FAILED');
  }, identity);
  expect(identity.signOut).toHaveBeenCalledTimes(1);
  expect(identity.restore).not.toHaveBeenCalled();
  expect(warning).toContain('segurança');
  expect(warning).not.toContain('native secret');
});
