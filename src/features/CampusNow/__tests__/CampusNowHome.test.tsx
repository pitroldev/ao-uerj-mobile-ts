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

/** O que o aparelho guarda do Agora no campus (`visited`: já abriu a tela). */
let mockSaved: Record<string, unknown> | null;

function setup(
  now: Date,
  notices: CampusNotice[],
  {
    saved = { visited: true },
    offline = false,
  }: { saved?: Record<string, unknown> | null; offline?: boolean } = {},
) {
  mockNotices = notices;
  mockSaved = saved;
  mockServer = {
    list: jest.fn(async () => {
      if (offline) throw new Error('offline');
      return {
        notices: mockNotices,
        helpersToday: 40,
        you: { points: 10, level: 1, levelAt: 0, nextLevelAt: 100 },
      };
    }),
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
      store: {
        read: async <T,>() => mockSaved as T | null,
        write: jest.fn(async (_scope: string, _key: string, value: unknown) => {
          mockSaved = value as Record<string, unknown>;
        }),
      },
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

it('says what it is for away from the campus, without asking the server', async () => {
  const user = userEvent.setup();
  const sunday = new Date(2026, 10, 22, 14, 5);
  await setup(sunday, [notice(sunday)]);
  expect(await screen.findByText('Avisos sobre o campus')).toBeOnTheScreen();
  expect(mockServer.list).not.toHaveBeenCalled();
  await user.press(
    screen.getByRole('button', {
      name: 'Agora no campus: avisos sobre o campus. Ver',
    }),
  );
  expect(mockNavigate).toHaveBeenCalledWith('Agora no campus');
});

it('says nothing is on the way when there is no notice, and reports in one tap', async () => {
  const user = userEvent.setup();
  const monday = new Date(2026, 10, 23, 15, 0);
  await setup(monday, []);
  expect(await screen.findByText('Nada no seu caminho')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Avisar' }));
  expect(mockNavigate).toHaveBeenCalledWith('Agora no campus', {
    report: true,
  });
});

it('does not promise calm without an answer from the server', async () => {
  const monday = new Date(2026, 10, 23, 15, 0);
  await setup(monday, [], { offline: true });
  expect(await screen.findByText('Avisos sobre o campus')).toBeOnTheScreen();
  expect(screen.queryByText('Nada no seu caminho')).toBeNull();
});

it('introduces itself once, until the student opens the screen or says "Agora não"', async () => {
  const user = userEvent.setup();
  const monday = new Date(2026, 10, 23, 15, 0);
  await setup(monday, [], { saved: null });
  expect(await screen.findByText('Novo')).toBeOnTheScreen();
  expect(screen.queryByText('Nada no seu caminho')).toBeNull();
  await user.press(screen.getByRole('button', { name: 'Conhecer' }));
  expect(mockNavigate).toHaveBeenCalledWith('Agora no campus');
  await user.press(screen.getByRole('button', { name: 'Agora não' }));
  expect(await screen.findByText('Nada no seu caminho')).toBeOnTheScreen();
  expect(mockSaved).toMatchObject({ introduced: true, visited: false });
  expect(screen.queryByText('Novo')).toBeNull();
});

it('asks about a notice on the way before introducing itself', async () => {
  const now = new Date(2026, 10, 23, 14, 5);
  await setup(now, [notice(now)], { saved: null });
  expect(
    await screen.findByText('Os elevadores ainda estão parados?'),
  ).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Conhecer' })).toBeNull();
});

it('stays out when turned off remotely', async () => {
  mockDisabled = ['campus'];
  const monday = new Date(2026, 10, 23, 15, 0);
  await setup(monday, [notice(monday)]);
  expect(screen.toJSON()).toBeNull();
});
