import { act } from '@testing-library/react-native';

import { createTestQueryClient } from '@root/test-utils/render';
import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import { academicKeys } from '@root/modules/academics/presentation/queryKeys';
import type { RemoteStatus } from '@root/modules/delivery/application/RemoteStatus';
import type { IdentityController } from '@root/modules/identity/application/IdentityController';
import type { IdentityState } from '@root/modules/identity/domain/types';
import {
  createDevice,
  createStore,
  settle,
} from '@root/modules/notifications/application/__tests__/fakes';
import { createNotifications } from '../createNotifications';

const ACCOUNT = {
  scope: 'account-1',
  period: '2026.2',
  matricula: '202310045612',
  name: 'Marina',
};
/** Sexta, 16/10/2026, 14h. */
const AFTERNOON = new Date(2026, 9, 16, 14, 0).getTime();

const meeting: AttendedClassesSchedule = {
  class: {
    id: 'IME02-00001',
    name: 'Cálculo II',
    class: '3',
    avaLocation: '',
    uerjLocation: 'Sala 6019 B',
    status: 'ACTIVE',
  },
  dayAlias: 'Terça-feira',
  dayNumber: 2,
  subject_id: 'IME02-00001',
  periodAlias: 'T3',
  startTimeAlias: '14:20',
  endTimeAlias: '16:00',
  start_time_in_minutes: 860,
  end_time_in_minutes: 960,
};

function setup(
  preferences: Record<string, unknown>,
  disabled: string[] = [],
  device = createDevice(),
) {
  let state: IdentityState = {
    status: 'restoring',
    account: null,
    error: null,
  };
  const listeners = new Set<() => void>();
  const identity = {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } as unknown as IdentityController;
  const signIn = () => {
    state = { status: 'signedIn', account: ACCOUNT, error: null };
    listeners.forEach(listener => listener());
  };
  const queryClient = createTestQueryClient();
  const store = createStore({
    [`${ACCOUNT.scope}/notifications`]: preferences,
  });
  const remoteStatus = {
    getSnapshot: () => ({
      status: {
        schemaVersion: 1,
        minSupportedVersion: '1.0.0',
        notices: [],
        disabledFeatures: disabled,
      },
      dismissed: new Set<string>(),
    }),
    subscribe: () => () => undefined,
  } as unknown as Pick<RemoteStatus, 'getSnapshot' | 'subscribe'>;
  const records = {
    getGrades: jest.fn(async () => [
      {
        id: 'IME02-00001',
        name: 'Cálculo II',
        class: '3',
        grades: { p1: 7, p2: 8.5, pf: null, result: null },
      },
    ]),
    getHistory: jest.fn(),
    getComplementaryActivities: jest.fn(),
    getCurriculum: jest.fn(),
    getSchedule: jest.fn(async () => [meeting]),
    getPartialRid: jest.fn(),
    getEnrollmentResult: jest.fn(),
    getSubjectDetails: jest.fn(),
    getUniversalSubjects: jest.fn(),
    getSynthesis: jest.fn(),
  };
  const flushCache = jest.fn(async () => undefined);
  const update = async <T,>(
    scope: string,
    name: string,
    change: (current: T | null) => T,
  ) => {
    const next = change(await store.read<T>(scope, name));
    await store.write(scope, name, next);
    return next;
  };
  const notifications = createNotifications({
    queryClient,
    identity,
    preferences: { ...store, update, remove: jest.fn() },
    records,
    documents: { list: jest.fn(async () => []) },
    remoteStatus,
    flushCache,
    savedScope: async () => identity.getSnapshot().account?.scope ?? null,
    probePortal: async () => true,
    device,
  });
  const key = (resource: string) =>
    academicKeys.resource(ACCOUNT.scope, ACCOUNT.period, resource);
  return {
    notifications,
    queryClient,
    device,
    signIn,
    key,
    records,
    flushCache,
  };
}

it('plans the reminders from the schedule the app loads', async () => {
  const { queryClient, device, signIn, key } = setup({ classReminders: true });
  signIn();
  await act(settle);
  // sem a grade salva, o que já está no aparelho fica como está
  expect(device.setClassReminders).not.toHaveBeenCalled();

  await act(() => {
    queryClient.setQueryData(key('schedule'), [meeting]);
  });
  await act(settle);
  expect(device.state.plan?.reminders).toEqual([
    expect.objectContaining({
      weekday: 2,
      minutes: 845,
      title: 'Cálculo II às 14:20',
      body: 'Sala 6019 B',
    }),
  ]);
});

it('leaves the portal tasks out where the device has no background checks (iOS)', async () => {
  const { notifications, queryClient, device, signIn, key } = setup(
    { classReminders: true, grades: true },
    [],
    createDevice({ backgroundChecks: false }),
  );
  expect(notifications.portalCheck).toBeNull();
  expect(notifications.portalReturn).toBeNull();
  signIn();
  await act(() => {
    queryClient.setQueryData(key('schedule'), [meeting]);
  });
  await act(settle);
  // os lembretes de aula seguem
  expect(device.state.plan?.reminders).toHaveLength(1);
  expect(device.setPortalCheck).not.toHaveBeenCalledWith(true, 4);
});

it('compares the portal check with what the app showed and saves the new reading', async () => {
  const { notifications, queryClient, device, signIn, key, flushCache } = setup(
    {
      grades: true,
    },
  );
  signIn();
  await act(settle);
  queryClient.setQueryData(key('grades'), [
    {
      id: 'IME02-00001',
      name: 'Cálculo II',
      class: '3',
      grades: { p1: 7, p2: null, pf: null, result: null },
    },
  ]);
  jest.spyOn(Date, 'now').mockReturnValue(AFTERNOON);
  try {
    await expect(notifications.portalCheck!.run()).resolves.toBe('ok');
  } finally {
    jest.restoreAllMocks();
  }
  expect(device.notify).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Nova nota em Cálculo II' }),
  );
  expect(queryClient.getQueryData(key('grades'))).toEqual([
    expect.objectContaining({ grades: expect.objectContaining({ p2: 8.5 }) }),
  ]);
  expect(flushCache).toHaveBeenCalled();
});

it('cancels with the remote switch before the account is restored', async () => {
  // tarefa sem tela: o aviso remoto desliga os avisos e ela termina sem
  // restaurar a conta
  const { notifications, device } = setup(
    { grades: true, classReminders: true },
    ['notifications'],
  );
  await act(settle);
  expect(notifications.settings.getSnapshot().ready).toBe(false);
  expect(device.state).toMatchObject({ plan: null, portal: false });
});

it('honors the remote switch', async () => {
  const { notifications, device, signIn, records } = setup(
    { grades: true, classReminders: true },
    ['notifications'],
  );
  signIn();
  await act(settle);
  expect(notifications.settings.getSnapshot().remoteDisabled).toBe(true);
  expect(device.state).toMatchObject({ plan: null, portal: false });
  await expect(notifications.portalCheck!.run()).resolves.toBe('skipped');
  expect(records.getGrades).not.toHaveBeenCalled();
});

it('replans only for the schedule of the active account and period', async () => {
  const { notifications, queryClient, signIn, key } = setup({
    classReminders: true,
  });
  signIn();
  await act(settle);
  const replan = jest.spyOn(notifications.settings, 'scheduleChanged');
  await act(() => {
    queryClient.setQueryData(
      academicKeys.resource('account-2', ACCOUNT.period, 'schedule'),
      [meeting],
    );
    queryClient.setQueryData(
      academicKeys.resource(ACCOUNT.scope, '2026.1', 'schedule'),
      [meeting],
    );
    queryClient.setQueryData(key('grades'), []);
  });
  expect(replan).not.toHaveBeenCalled();

  await act(() => {
    queryClient.setQueryData(key('schedule'), [meeting]);
  });
  expect(replan).toHaveBeenCalled();
});
