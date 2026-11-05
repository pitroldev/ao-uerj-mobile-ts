import type { Spec } from '@root/specs/NativeAppNotifications';
import { createNativeBackgroundRounds } from '../NativeBackgroundRounds';

// no Jest o TurboModuleRegistry não encontra o módulo
jest.mock('@root/specs/NativeAppNotifications', () => ({
  __esModule: true,
  default: null,
}));

function nativeModule() {
  const order: string[] = [];
  let round: ((value: unknown) => void) | null = null;
  let expired: ((id: string) => void) | null = null;
  const removeRound = jest.fn();
  const removeExpired = jest.fn();
  const module = {
    onBackgroundTask: jest.fn((listener: (value: unknown) => void) => {
      order.push('subscribe-round');
      round = listener;
      return { remove: removeRound };
    }),
    onBackgroundTaskExpired: jest.fn((listener: (id: string) => void) => {
      order.push('subscribe-expired');
      expired = listener;
      return { remove: removeExpired };
    }),
    listenBackgroundTasks: jest.fn(async () => {
      order.push('listen');
    }),
    setTaskCompleted: jest.fn(async (_id: string, _success: boolean) => {}),
  };
  return {
    module: module as unknown as Spec & typeof module,
    order,
    removeRound,
    removeExpired,
    emitRound: (value: unknown) => round?.(value),
    emitExpired: (id: string) => expired?.(id),
  };
}

it('is absent where the native module does not exist', () => {
  expect(createNativeBackgroundRounds()).toBeNull();
});

it('subscribes to the rounds before telling the device that JS listens', () => {
  const { module, order } = nativeModule();
  createNativeBackgroundRounds(module)!.listen({
    start: () => undefined,
    expire: () => undefined,
  });
  expect(order).toEqual(['subscribe-round', 'subscribe-expired', 'listen']);
});

it('hands over the rounds and expirations, keeping only text modes', () => {
  const { module, emitRound, emitExpired } = nativeModule();
  const start = jest.fn();
  const expire = jest.fn();
  createNativeBackgroundRounds(module)!.listen({ start, expire });
  emitRound({ id: 'r1', modes: ['return', 7, 'check'] });
  emitRound({ id: 'r2', modes: null });
  // sem id, não há como encerrar a rodada: fica com o aparelho
  emitRound({ modes: ['check'] });
  emitExpired('r1');
  expect(start.mock.calls).toEqual([
    [{ id: 'r1', modes: ['return', 'check'] }],
    [{ id: 'r2', modes: [] }],
  ]);
  expect(expire).toHaveBeenCalledWith('r1');
});

it('ends a round on the device and stops listening', async () => {
  const { module, removeRound, removeExpired } = nativeModule();
  const rounds = createNativeBackgroundRounds(module)!;
  const stop = rounds.listen({
    start: () => undefined,
    expire: () => undefined,
  });
  await rounds.finish('r1', false);
  expect(module.setTaskCompleted).toHaveBeenCalledWith('r1', false);
  stop();
  expect(removeRound).toHaveBeenCalledTimes(1);
  expect(removeExpired).toHaveBeenCalledTimes(1);
});
