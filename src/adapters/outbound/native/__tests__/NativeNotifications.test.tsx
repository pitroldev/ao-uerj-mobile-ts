import type { Spec } from '@root/specs/NativeAppNotifications';
import {
  createNativeNotifications,
  createNotificationLaunches,
} from '../NativeNotifications';

// fora do Android o TurboModuleRegistry não encontra o módulo
jest.mock('@root/specs/NativeAppNotifications', () => ({
  __esModule: true,
  default: null,
}));

const RESULTS = {
  GRANTED: 'granted',
  DENIED: 'denied',
  NEVER_ASK_AGAIN: 'never_ask_again',
} as const;

function nativeModule({ enabled = false } = {}) {
  let handler: ((target: string) => void) | null = null;
  const remove = jest.fn();
  const state = { enabled };
  const module = {
    areNotificationsEnabled: jest.fn(async () => state.enabled),
    openNotificationSettings: jest.fn(async () => undefined),
    canScheduleExactAlarms: jest.fn(async () => false),
    openExactAlarmSettings: jest.fn(async () => undefined),
    setClassReminders: jest.fn(async (_plan: string) => undefined),
    setPortalCheck: jest.fn(async (_on: boolean, _hours: number) => undefined),
    notify: jest.fn(async () => undefined),
    clearNotifications: jest.fn(async () => undefined),
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
    state,
    remove,
    emit: (target: string) => handler?.(target),
  };
}

function permissions(result: string, grant?: () => void) {
  return {
    PERMISSIONS: {
      POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
    },
    RESULTS,
    request: jest.fn(async () => {
      grant?.();
      return result;
    }),
  } as never;
}

it('is absent where the native module does not exist (iOS)', () => {
  expect(createNativeNotifications()).toBeNull();
  expect(createNotificationLaunches()).toBeNull();
});

it('reports the system state and asks on Android 13+', async () => {
  const { module, state } = nativeModule();
  const device = createNativeNotifications(module, {
    apiLevel: 34,
    permissions: permissions(RESULTS.GRANTED, () => {
      state.enabled = true;
    }),
  })!;
  await expect(device.permission()).resolves.toBe('denied');
  await expect(device.requestPermission()).resolves.toBe('granted');
  await expect(device.permission()).resolves.toBe('granted');
});

it.each([
  [RESULTS.DENIED, 'denied'],
  [RESULTS.NEVER_ASK_AGAIN, 'blocked'],
  // concedida no pedido, mas o app segue sem avisos no sistema
  [RESULTS.GRANTED, 'blocked'],
])('maps the answer %s to %s', async (answer, expected) => {
  const { module } = nativeModule();
  const device = createNativeNotifications(module, {
    apiLevel: 33,
    permissions: permissions(answer),
  })!;
  await expect(device.requestPermission()).resolves.toBe(expected);
});

it('sends to the settings before Android 13, where there is no prompt', async () => {
  const { module } = nativeModule();
  const ask = permissions(RESULTS.GRANTED);
  const device = createNativeNotifications(module, {
    apiLevel: 31,
    permissions: ask,
  })!;
  await expect(device.requestPermission()).resolves.toBe('blocked');
  expect((ask as { request: jest.Mock }).request).not.toHaveBeenCalled();
});

it('hands the reminder plan to the native side as JSON, or cancels it', async () => {
  const { module } = nativeModule();
  const device = createNativeNotifications(module, { apiLevel: 34 })!;
  const plan = {
    expiresAt: 10,
    leadMinutes: 15,
    reminders: [{ id: 'a', weekday: 2, minutes: 845, title: 't', body: 'b' }],
  };
  await device.setClassReminders(plan);
  await device.setClassReminders(null);
  expect(module.setClassReminders.mock.calls).toEqual([
    [JSON.stringify(plan)],
    [''],
  ]);
  await device.setPortalCheck(true, 4);
  expect(module.setPortalCheck).toHaveBeenCalledWith(true, 4);
  await device.clearPosted();
  expect(module.clearNotifications).toHaveBeenCalledTimes(1);
});

it('opens the screen of a tapped notification and ignores unknown targets', async () => {
  const { module, emit, remove } = nativeModule();
  const launches = createNotificationLaunches(module)!;
  await expect(launches.consume()).resolves.toBe('documents');
  module.consumeLaunchTarget.mockResolvedValueOnce('qualquer');
  await expect(launches.consume()).resolves.toBeNull();

  // o evento manda ler o destino, que sai do intent na primeira leitura
  const listener = jest.fn();
  const unsubscribe = launches.subscribe(listener);
  module.consumeLaunchTarget
    .mockResolvedValueOnce('home')
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce('outra');
  emit('home');
  emit('home');
  emit('outra');
  await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
  expect(listener.mock.calls).toEqual([['home']]);
  unsubscribe();
  expect(remove).toHaveBeenCalled();
});
