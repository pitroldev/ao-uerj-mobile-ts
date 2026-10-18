import { createTestQueryClient } from '@root/test-utils/render';
import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import { academicKeys } from '@root/modules/academics/presentation/queryKeys';
import type { IdentityState } from '@root/modules/identity/domain/types';
import type { WidgetSchedule } from '@root/modules/widget/domain/nextClassWidget';
import { createWidget } from '../createWidget';

const ACCOUNT = {
  scope: 'account-1',
  period: '2026.2',
  matricula: '202310045612',
  name: 'Marina',
};

const meeting: AttendedClassesSchedule = {
  class: {
    id: 'IME02-00001',
    name: 'Cálculo II',
    class: '3',
    avaLocation: '',
    uerjLocation: 'Pav. João Lyra Filho · 6º andar · Sala 6019 B',
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

const settle = () =>
  new Promise<void>(resolve => setTimeout(() => resolve(), 0));

function setup() {
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
      return () => {
        listeners.delete(listener);
      };
    },
  };
  const publish = (next: IdentityState) => {
    state = next;
    listeners.forEach(listener => listener());
  };
  const queryClient = createTestQueryClient();
  const sent: (WidgetSchedule | 'signed-in' | null)[] = [];
  const device = {
    setSchedule: jest.fn(async (schedule: WidgetSchedule | null) => {
      sent.push(schedule);
    }),
    setSignedIn: jest.fn(async () => {
      sent.push('signed-in');
    }),
  };
  createWidget({ queryClient, identity, device });
  return { queryClient, device, sent, publish };
}

it('sends the schedule the app loads to the widget, and clears it on sign out', async () => {
  const { queryClient, device, sent, publish } = setup();
  publish({ status: 'signedIn', account: ACCOUNT, error: null });
  await settle();
  // sem grade salva ainda: o widget mantém a que tiver e não pede o login
  expect(device.setSchedule).not.toHaveBeenCalled();
  expect(sent).toEqual(['signed-in']);

  queryClient.setQueryData(
    academicKeys.resource(ACCOUNT.scope, ACCOUNT.period, 'schedule'),
    [meeting],
  );
  await settle();
  expect(sent).toEqual([
    'signed-in',
    expect.objectContaining({
      classes: [
        expect.objectContaining({
          title: 'Cálculo II',
          detail: 'T3–T4 · Sala 6019 B',
          place: 'Pav. João Lyra Filho · 6º andar',
          startLabel: '14:20',
        }),
      ],
    }),
  ]);

  publish({ status: 'signedOut', account: null, error: null });
  await settle();
  expect(sent[sent.length - 1]).toBeNull();
});
