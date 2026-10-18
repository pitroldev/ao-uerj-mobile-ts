import type { Spec } from '@root/specs/NativeAppNotifications';
import { createLaunches } from '../NativeLaunches';

// fora do Android o TurboModuleRegistry não encontra o módulo
jest.mock('@root/specs/NativeAppNotifications', () => ({
  __esModule: true,
  default: null,
}));

function nativeModule() {
  let handler: ((target: string) => void) | null = null;
  const remove = jest.fn();
  const module = {
    consumeLaunchTarget: jest.fn(
      async (): Promise<string | null> => 'documents',
    ),
    onOpenTarget: jest.fn((next: (target: string) => void) => {
      handler = next;
      return { remove };
    }),
  };
  return {
    module: module as unknown as Spec & typeof module,
    remove,
    emit: (target: string) => handler?.(target),
  };
}

it('is absent where the native module does not exist (iOS)', () => {
  expect(createLaunches()).toBeNull();
});

it('reads the target of each launch once and ignores unknown targets', async () => {
  const { module, emit, remove } = nativeModule();
  const launches = createLaunches(module)!;
  await expect(launches.consume()).resolves.toBe('documents');
  module.consumeLaunchTarget.mockResolvedValueOnce('qualquer');
  await expect(launches.consume()).resolves.toBeNull();

  // o evento manda ler o destino, que sai do intent na primeira leitura
  const listener = jest.fn();
  const unsubscribe = launches.subscribe(listener);
  module.consumeLaunchTarget
    .mockResolvedValueOnce('map')
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce('outra');
  emit('map');
  emit('map');
  emit('outra');
  await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
  expect(listener.mock.calls).toEqual([['map']]);
  unsubscribe();
  expect(remove).toHaveBeenCalled();
});
