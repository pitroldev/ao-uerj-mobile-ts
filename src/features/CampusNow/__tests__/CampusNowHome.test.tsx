import React from 'react';
import { screen, userEvent, waitFor } from '@testing-library/react-native';

import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import { CampusNow } from '@root/modules/campus-now/application/CampusNow';
import type { CampusNowServerPort } from '@root/modules/campus-now/application/ports';
import type {
  CampusNotice,
  NoticeAnswer,
} from '@root/modules/campus-now/domain/campusNow';
import {
  createTestQueryClient,
  renderWithProviders,
} from '@root/test-utils/render';
import { CampusNowHome } from '../CampusNowHome';

const MINUTE = 60_000;

const lesson = (start: number, end: number): AttendedClassesSchedule => ({
  class: {
    id: 'calc',
    name: 'Cálculo II',
    class: '1',
    avaLocation: '',
    uerjLocation: 'Pav. João Lyra Filho · Sala 6019 B',
    status: 'ACTIVE',
  },
  dayAlias: 'Seg',
  dayNumber: 1,
  subject_id: 'calc',
  periodAlias: 'T3',
  startTimeAlias: '',
  endTimeAlias: '',
  start_time_in_minutes: start,
  end_time_in_minutes: end,
});
const SCHEDULE = [lesson(860, 960)];

let mockNotices: CampusNotice[];
let mockServer: jest.Mocked<CampusNowServerPort>;
let mockServices: Record<string, unknown>;
let mockDisabled: string[] = [];

function notice(now: Date, partial: Partial<CampusNotice> = {}): CampusNotice {
  return {
    id: 'lift',
    kind: 'elevators',
    status: 'stopped',
    place: { type: 'elevators' },
    createdAt: now.getTime() - 10 * MINUTE,
    expiresAt: now.getTime() + 60 * MINUTE,
    state: 'active',
    confirmations: 2,
    ends: 0,
    confirmed: true,
    level: null,
    mine: false,
    answer: null,
    thanked: false,
    flagged: false,
    views: null,
    thanks: null,
    ...partial,
  };
}

function setup(now: Date, notices: CampusNotice[]) {
  mockNotices = notices;
  mockServer = {
    list: jest.fn(async () => ({
      notices: mockNotices,
      helpersToday: 40,
      you: { points: 10, level: 1, levelAt: 0, nextLevelAt: 100 },
    })),
    report: jest.fn(),
    answer: jest.fn(async (id: string, _answer: NoticeAnswer) => ({
      notice: {
        ...mockNotices.find(item => item.id === id)!,
        answer: 'confirm' as const,
      },
      you: { points: 13, level: 1, levelAt: 0, nextLevelAt: 100, earned: 3 },
    })),
    thank: jest.fn(),
    flag: jest.fn(),
    seen: jest.fn(),
    you: jest.fn(),
    community: jest.fn(),
  };
  mockServices = {
    campusNow: new CampusNow({
      server: mockServer,
      store: { read: async () => null, write: async () => undefined },
      account: () => ({ scope: 'account-1' }),
      now: () => now.getTime(),
    }),
  };
  return renderWithProviders(<CampusNowHome schedule={SCHEDULE} now={now} />, {
    queryClient: createTestQueryClient(),
  });
}

jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: () => mockServices,
  useIdentity: () => ({
    status: 'signedIn',
    account: { scope: 'account-1', name: 'MARINA', period: '2026.2' },
  }),
}));
jest.mock('@root/modules/delivery/presentation/DeliveryProvider', () => ({
  useRemoteStatus: () => ({
    status: { disabledFeatures: mockDisabled, notices: [] },
  }),
  // o "Valeu" recebido vira momento bom (teste no CampusNow)
  usePositiveMoment: () => mockPositiveMoment,
}));
const mockPositiveMoment = jest.fn();
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useIsFocused: () => true,
}));

beforeEach(() => {
  mockDisabled = [];
});

it('asks "still there?" on the Home page when a notice is on the way to class', async () => {
  const user = userEvent.setup();
  const now = new Date(2026, 10, 23, 14, 5);
  await setup(now, [notice(now)]);
  expect(
    await screen.findByText('Os elevadores ainda estão parados?'),
  ).toBeOnTheScreen();
  await user.press(
    screen.getByRole('button', {
      name: 'Continua: Os elevadores ainda estão parados?',
    }),
  );
  await waitFor(() =>
    expect(mockServer.answer).toHaveBeenCalledWith('lift', 'confirm'),
  );
});

it('lists the confirmed notices of now, and opens the screen', async () => {
  const user = userEvent.setup();
  // em aula no 6º andar, a fila do bandejão não é do caminho
  const now = new Date(2026, 10, 23, 15, 0);
  await setup(now, [
    notice(now, {
      id: 'ru',
      kind: 'ru',
      status: 'long_queue',
      place: { type: 'ru' },
    }),
    notice(now, {
      id: 'novo',
      kind: 'internet',
      status: 'wifi_down',
      place: { type: 'floor', block: 'A', floor: '3' },
      confirmed: false,
      confirmations: 0,
    }),
  ]);
  expect(await screen.findByText('Fila grande no bandejão')).toBeOnTheScreen();
  expect(
    screen.getByText('1 aviso agora · 40 colegas ajudaram hoje'),
  ).toBeOnTheScreen();
  // o novo, sem confirmação e fora do caminho, fica só na tela do Agora no campus
  expect(screen.queryByText('Wi-Fi fora')).toBeNull();
  await user.press(screen.getByRole('button', { name: /Ver todos/ }));
  expect(mockNavigate).toHaveBeenCalledWith('Agora no campus');
});

it('stays quiet away from the campus, without notices or when turned off remotely', async () => {
  const sunday = new Date(2026, 10, 22, 14, 5);
  await setup(sunday, [notice(sunday)]);
  expect(mockServer.list).not.toHaveBeenCalled();
  expect(screen.toJSON()).toBeNull();

  const monday = new Date(2026, 10, 23, 15, 0);
  await setup(monday, []);
  await waitFor(() => expect(mockServer.list).toHaveBeenCalled());
  expect(screen.toJSON()).toBeNull();

  mockDisabled = ['campus'];
  await setup(monday, [notice(monday)]);
  expect(screen.toJSON()).toBeNull();
});
