import React from 'react';
import { screen, userEvent, waitFor } from '@testing-library/react-native';

import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import type {
  CompanionCall,
  Membership,
} from '@root/modules/companion/domain/companion';
import {
  createTestQueryClient,
  renderWithProviders,
} from '@root/test-utils/render';
import { CompanionNow } from '../CompanionNow';

const at = (h: number, m: number) => new Date(2026, 10, 23, h, m).getTime();
const SCHEDULE: AttendedClassesSchedule[] = [
  {
    class: {
      id: 'calc',
      name: 'Cálculo II',
      class: '1',
      avaLocation: '',
      uerjLocation: 'Sala 6019 B',
      status: 'ACTIVE',
    },
    dayAlias: 'Seg',
    dayNumber: 1,
    subject_id: 'calc',
    periodAlias: 'T3',
    startTimeAlias: '14:20',
    endTimeAlias: '16:00',
    start_time_in_minutes: 860,
    end_time_in_minutes: 960,
  },
];
const call = (extra: Partial<CompanionCall>): CompanionCall => ({
  id: 'a1',
  kind: 'lunch',
  at: at(12, 15),
  spot: 'ru',
  destination: null,
  note: '',
  host: 'Júlia',
  going: 2,
  capacity: 6,
  listedUntil: at(12, 45),
  expiresAt: at(12, 45),
  ...extra,
});

let mockMemberships: Membership[] = [];
const mockList = jest.fn(async () => [
  call({}),
  call({ id: 'a2', at: at(12, 30), spot: 'lago', going: 4 }),
  call({ id: 'a3', at: at(13, 0), going: 1 }),
]);
let mockSupported = true;
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({
    companion: {
      supported: mockSupported,
      load: async () => undefined,
      subscribe: () => () => undefined,
      getSnapshot: () => mockMemberships,
      list: mockList,
    },
  }),
  useIdentity: () => ({ account: { scope: 'account-1' } }),
}));
jest.mock('@root/modules/delivery/presentation/DeliveryProvider', () => ({
  useRemoteStatus: () => ({ status: null }),
}));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useIsFocused: () => true,
}));

const renderAt = (now: Date) =>
  renderWithProviders(<CompanionNow schedule={SCHEDULE} now={now} />, {
    queryClient: createTestQueryClient(),
  });

beforeEach(() => {
  mockMemberships = [];
  mockSupported = true;
});

it('shows the open tables in the free lunch window, the nearest first', async () => {
  const user = userEvent.setup();
  await renderAt(new Date(2026, 10, 23, 12, 5));
  expect(
    await screen.findByText('Livre até 14:20 · 3 mesas abertas'),
  ).toBeOnTheScreen();
  const rows = screen.getAllByText(/^Mesa no/);
  expect(rows.map(row => row.props.children)).toEqual([
    'Mesa no RU, 12:15',
    'Mesa no Lago dos Peixinhos, 12:30',
  ]);
  expect(screen.getByText('Júlia chamou · 2 vão')).toBeOnTheScreen();
  await user.press(screen.getByText('Mesa no RU, 12:15'));
  expect(mockNavigate).toHaveBeenCalledWith('Companhia agora', {
    callId: 'a1',
  });
});

it('stays out of the way in class', async () => {
  await renderAt(new Date(2026, 10, 23, 15, 0));
  expect(screen.queryByText('Companhia agora')).not.toBeOnTheScreen();
  expect(mockList).not.toHaveBeenCalled();
});

it('says nothing when nobody called', async () => {
  mockList.mockResolvedValueOnce([]);
  await renderAt(new Date(2026, 10, 23, 12, 5));
  await waitFor(() => expect(mockList).toHaveBeenCalled());
  expect(screen.queryByText('Companhia agora')).not.toBeOnTheScreen();
});

it('does not exist where the app has no anonymous tokens', async () => {
  mockSupported = false;
  await renderAt(new Date(2026, 10, 23, 12, 5));
  expect(screen.queryByText('Companhia agora')).not.toBeOnTheScreen();
  expect(mockList).not.toHaveBeenCalled();
});

it('keeps the call the student is in, even in class', async () => {
  mockMemberships = [
    {
      callId: 'v1',
      memberKey: 'k',
      host: false,
      kind: 'home',
      at: at(22, 15),
      spot: 'concha',
      destination: 'metro',
      expiresAt: at(24, 15),
    },
  ];
  await renderAt(new Date(2026, 10, 23, 15, 0));
  expect(screen.getByText('Companhia agora')).toBeOnTheScreen();
  expect(screen.getByText('Volta para o metrô, 22:15')).toBeOnTheScreen();
  expect(screen.getByText('Você vai junto')).toBeOnTheScreen();
});
