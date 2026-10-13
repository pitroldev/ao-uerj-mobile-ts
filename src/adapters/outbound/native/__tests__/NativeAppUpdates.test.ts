import type {
  NativeAppUpdateInfo,
  NativeInstallState,
  Spec,
} from '@root/specs/NativeInAppUpdates';
import { createNativeAppUpdates } from '../NativeAppUpdates';

// fora do Android o TurboModuleRegistry não encontra o módulo
jest.mock('@root/specs/NativeInAppUpdates', () => ({
  __esModule: true,
  default: null,
}));

const info = (
  overrides: Partial<NativeAppUpdateInfo> = {},
): NativeAppUpdateInfo => ({
  availability: 'available',
  availableVersionCode: 10040000,
  stalenessDays: 4,
  priority: 2,
  flexibleAllowed: true,
  immediateAllowed: false,
  installStatus: 'pending',
  ...overrides,
});

function nativeModule() {
  let handler: ((state: NativeInstallState) => void) | null = null;
  const remove = jest.fn(() => {
    handler = null;
  });
  const module = {
    checkUpdate: jest.fn(async () => info()),
    startUpdate: jest.fn(async (_type: string) => 'accepted'),
    completeUpdate: jest.fn(async () => undefined),
    onInstallState: jest.fn((next: (state: NativeInstallState) => void) => {
      handler = next;
      return { remove };
    }),
  };
  return {
    module: module as unknown as Spec & typeof module,
    remove,
    emit: (state: NativeInstallState) => handler?.(state),
  };
}

it('is absent where the native module does not exist (iOS)', () => {
  expect(createNativeAppUpdates()).toBeNull();
});

it('maps the Play info and hides unknown values', async () => {
  const { module } = nativeModule();
  const updates = createNativeAppUpdates(module)!;
  await expect(updates.check()).resolves.toEqual({
    availability: 'available',
    versionCode: 10040000,
    stalenessDays: 4,
    priority: 2,
    flexibleAllowed: true,
    immediateAllowed: false,
    installStatus: 'pending',
  });
  module.checkUpdate.mockResolvedValueOnce(
    info({
      availability: 'notAvailable',
      stalenessDays: -1,
      installStatus: 'requiresUi',
    }),
  );
  await expect(updates.check()).resolves.toMatchObject({
    availability: 'none',
    stalenessDays: null,
    installStatus: 'unknown',
  });
});

it('turns a Play failure (app not installed from the store) into "no update"', async () => {
  const { module } = nativeModule();
  module.checkUpdate.mockRejectedValueOnce(
    new Error('-10: ERROR_APP_NOT_OWNED'),
  );
  await expect(createNativeAppUpdates(module)!.check()).resolves.toBeNull();
});

it('starts and completes the flows', async () => {
  const { module } = nativeModule();
  const updates = createNativeAppUpdates(module)!;
  await expect(updates.start('immediate')).resolves.toBe('accepted');
  expect(module.startUpdate).toHaveBeenCalledWith('immediate');
  module.startUpdate.mockResolvedValueOnce('algo-novo');
  await expect(updates.start('flexible')).resolves.toBe('failed');
  await updates.complete();
  expect(module.completeUpdate).toHaveBeenCalled();
});

it('forwards the install progress until unsubscribed', () => {
  const { module, remove, emit } = nativeModule();
  const listener = jest.fn();
  const stop = createNativeAppUpdates(module)!.onInstallProgress(listener);
  emit({
    installStatus: 'downloading',
    bytesDownloaded: 10,
    totalBytesToDownload: 40,
    errorCode: 0,
  });
  expect(listener).toHaveBeenCalledWith({
    status: 'downloading',
    bytesDownloaded: 10,
    totalBytes: 40,
  });
  stop();
  expect(remove).toHaveBeenCalled();
});
