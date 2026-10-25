import type { ReminderPlan } from '../../domain/classReminders';
import type { NotificationContent } from '../../domain/messages';
import type {
  ActiveAccount,
  NotificationDevicePort,
  NotificationStore,
  PermissionState,
} from '../ports';

/** Cópia como a do AsyncStorage (os valores passam por JSON). */
const copy = (value: unknown) =>
  value === undefined ? value : JSON.parse(JSON.stringify(value));

export function createStore(initial: Record<string, unknown> = {}) {
  const data = new Map<string, unknown>(Object.entries(initial));
  const store = {
    data,
    read: jest.fn(async (scope: string, key: string) => {
      const name = `${scope}/${key}`;
      return data.has(name) ? copy(data.get(name)) : null;
    }),
    write: jest.fn(async (scope: string, key: string, value: unknown) => {
      data.set(`${scope}/${key}`, copy(value));
    }),
  };
  return store as typeof store & NotificationStore;
}

export function createDevice({
  permission = 'granted',
  request = 'granted',
  exactAlarms = true,
  backgroundChecks = true,
}: {
  permission?: PermissionState;
  request?: PermissionState;
  exactAlarms?: boolean;
  /** `false` como no iOS: só os lembretes de aula. */
  backgroundChecks?: boolean;
} = {}) {
  const state: {
    permission: PermissionState;
    plan?: ReminderPlan | null;
    portal?: boolean;
    returnWatch?: boolean;
  } = { permission };
  const device = {
    state,
    backgroundChecks,
    permission: jest.fn(async () => state.permission),
    requestPermission: jest.fn(async () => {
      state.permission = request;
      return request;
    }),
    openSettings: jest.fn(async () => undefined),
    exactAlarmsAllowed: jest.fn(async () => exactAlarms),
    openExactAlarmSettings: jest.fn(async () => undefined),
    setClassReminders: jest.fn(async (plan: ReminderPlan | null) => {
      state.plan = plan;
    }),
    setPortalCheck: jest.fn(async (enabled: boolean) => {
      state.portal = enabled;
    }),
    setPortalReturnWatch: jest.fn(async (enabled: boolean) => {
      state.returnWatch = enabled;
    }),
    notify: jest.fn(async (_content: NotificationContent) => undefined),
    // como o módulo nativo: limpar a barra também cancela os lembretes
    clearPosted: jest.fn(async () => {
      state.plan = null;
    }),
  };
  return device as typeof device & NotificationDevicePort;
}

/** Identidade observável: `undefined` restaurando, `null` sem conta. */
export function createAccount(initial?: ActiveAccount | null) {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(next: ActiveAccount | null | undefined) {
      current = next;
      listeners.forEach(listener => listener());
    },
  };
}

export function createRemote(disabled = false) {
  let current = disabled;
  const listeners = new Set<() => void>();
  return {
    disabled: () => current,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(next: boolean) {
      current = next;
      listeners.forEach(listener => listener());
    },
  };
}

/** Deixa as promessas encadeadas (leitura, permissão, aparelho) terminarem. */
export async function settle() {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
  await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
}
