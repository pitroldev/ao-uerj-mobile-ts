import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import type { WidgetSchedule } from '../../domain/nextClassWidget';
import { WidgetSync } from '../WidgetSync';
import type { WidgetAccount } from '../ports';

const ACCOUNT = { scope: 'account-1', period: '2026.2' };

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

type Saved = { data: AttendedClassesSchedule[]; updatedAt: number } | null;

/** Deixa a fila de envios ao aparelho terminar. */
const settle = () =>
  new Promise<void>(resolve => setTimeout(() => resolve(), 0));

function setup({ withDevice = true } = {}) {
  let account: WidgetAccount | null | undefined;
  const listeners = new Set<() => void>();
  const current: { schedule: Saved } = {
    schedule: { data: [meeting], updatedAt: 5000 },
  };
  const sent: (WidgetSchedule | 'signed-in' | null)[] = [];
  const device = {
    setSchedule: jest.fn(async (schedule: WidgetSchedule | null) => {
      sent.push(schedule);
    }),
    setSignedIn: jest.fn(async () => {
      sent.push('signed-in');
    }),
  };
  const sync = new WidgetSync({
    device: withDevice ? device : null,
    account: () => account,
    subscribeAccount: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    schedule: () => current.schedule,
    text: item => ({ title: item.class.name, detail: 'T3', place: '' }),
  });
  sync.start();
  const setAccount = (next: WidgetAccount | null | undefined) => {
    account = next;
    listeners.forEach(listener => listener());
  };
  return { sync, device, sent, current, setAccount };
}

it('leaves the widget alone while the account is being restored', async () => {
  const { device } = setup();
  await settle();
  expect(device.setSchedule).not.toHaveBeenCalled();
  expect(device.setSignedIn).not.toHaveBeenCalled();
});

it('sends the saved schedule of the account, and only when it changes', async () => {
  const { sync, device, sent, current, setAccount } = setup();
  setAccount(ACCOUNT);
  await settle();
  expect(sent).toEqual([
    expect.objectContaining({
      updatedAt: 5000,
      classes: [expect.objectContaining({ title: 'Cálculo II', start: 860 })],
    }),
  ]);

  await sync.scheduleChanged();
  expect(device.setSchedule).toHaveBeenCalledTimes(1);

  current.schedule = {
    data: [meeting, { ...meeting, dayNumber: 4 }],
    updatedAt: 9000,
  };
  await sync.scheduleChanged();
  expect(device.setSchedule.mock.calls[1]?.[0]?.classes).toHaveLength(2);
});

it('says there is an account until the schedule is read, and clears the widget on sign out', async () => {
  const { sync, device, sent, current, setAccount } = setup();
  current.schedule = null;
  setAccount(ACCOUNT);
  await settle();
  // sem grade lida: o widget mantém a que tiver e para de pedir o login
  expect(device.setSchedule).not.toHaveBeenCalled();
  expect(sent).toEqual(['signed-in']);
  await sync.scheduleChanged();
  expect(device.setSignedIn).toHaveBeenCalledTimes(1);

  current.schedule = { data: [meeting], updatedAt: 1 };
  await sync.scheduleChanged();
  setAccount(null);
  await settle();
  expect(sent).toEqual(['signed-in', expect.any(Object), null]);
});

it('stops asking to sign in after a login whose schedule is not read yet', async () => {
  const { sent, current, setAccount } = setup();
  setAccount(null);
  await settle();
  // o login publica "sem conta" antes de entrar, e o portal pode falhar depois
  current.schedule = null;
  setAccount(ACCOUNT);
  await settle();
  expect(sent).toEqual([null, 'signed-in']);
});

it('tries again on the next change when the device fails', async () => {
  const { sync, device, setAccount } = setup();
  device.setSchedule.mockRejectedValueOnce(new Error('falhou'));
  setAccount(ACCOUNT);
  await settle();
  await sync.scheduleChanged();
  expect(device.setSchedule).toHaveBeenCalledTimes(2);
});

it('is inert without the widget (iOS)', async () => {
  const { sync, setAccount } = setup({ withDevice: false });
  setAccount(ACCOUNT);
  await expect(sync.scheduleChanged()).resolves.toBeUndefined();
});
