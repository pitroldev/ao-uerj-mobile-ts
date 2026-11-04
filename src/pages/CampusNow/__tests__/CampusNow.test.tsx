import React from 'react';
import { Share } from 'react-native';
import {
  fireEvent,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import { snackbar } from '@components/ui';
import { bundledCampusMap } from '@root/adapters/outbound/campus-map';
import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import { CampusMap } from '@root/modules/campus-map/application/CampusMap';
import { CampusNow } from '@root/modules/campus-now/application/CampusNow';
import type { CampusNowServerPort } from '@root/modules/campus-now/application/ports';
import type {
  CampusNotice,
  NoticeRequest,
} from '@root/modules/campus-now/domain/campusNow';
import { AppError } from '@root/shared/errors/AppError';
import {
  createTestQueryClient,
  renderWithProviders,
} from '@root/test-utils/render';
import { CampusNowPage } from '../CampusNow';

const MINUTE = 60_000;
// segunda, 23 de novembro de 2026, 14:10: a caminho de Cálculo II, às 14:20
let mockNow = new Date(2026, 10, 23, 14, 10);
const NOW = () => mockNow.getTime();

const lesson = (
  name: string,
  start: number,
  end: number,
  room: string,
): AttendedClassesSchedule => ({
  class: {
    id: name,
    name,
    class: '1',
    avaLocation: '',
    uerjLocation: `Pav. João Lyra Filho · ${room}`,
    status: 'ACTIVE',
  },
  dayAlias: 'Seg',
  dayNumber: 1,
  subject_id: name,
  periodAlias: 'T3',
  startTimeAlias: '',
  endTimeAlias: '',
  start_time_in_minutes: start,
  end_time_in_minutes: end,
});
const mockSchedule = {
  data: [lesson('Cálculo II', 860, 960, 'Sala 6019 B')],
};

function notice(partial: Partial<CampusNotice> = {}): CampusNotice {
  return {
    id: 'lift',
    kind: 'elevators',
    status: 'long_queue',
    place: { type: 'elevators' },
    createdAt: NOW() - 29 * MINUTE,
    expiresAt: NOW() + 31 * MINUTE,
    state: 'active',
    confirmations: 7,
    ends: 0,
    confirmed: true,
    level: 4,
    mine: false,
    answer: null,
    thanked: false,
    flagged: false,
    views: null,
    thanks: null,
    ...partial,
  };
}

const YOU = { points: 290, level: 2, levelAt: 100, nextLevelAt: 300 };

let mockNotices: CampusNotice[];
let mockServer: jest.Mocked<CampusNowServerPort>;
let mockServices: Record<string, unknown>;
const NOTIFICATIONS = {
  supported: true,
  backgroundChecks: true,
  ready: true,
  permission: 'granted',
  preferences: { campusAlerts: true },
};

function services() {
  mockNotices = [
    notice(),
    notice({
      id: 'ru',
      kind: 'ru',
      status: 'short_queue',
      place: { type: 'ru' },
      mine: true,
      level: null,
      confirmations: 3,
      views: 37,
      thanks: 12,
    }),
    notice({
      id: 'wc',
      kind: 'restroom',
      status: 'no_water',
      place: { type: 'floor', block: 'F', floor: '3' },
      confirmed: false,
      confirmations: 0,
      level: null,
      createdAt: NOW() - 4 * MINUTE,
    }),
  ];
  const update = (id: string, change: Partial<CampusNotice>) => {
    mockNotices = mockNotices.map(item =>
      item.id === id ? { ...item, ...change } : item,
    );
    return mockNotices.find(item => item.id === id)!;
  };
  mockServer = {
    list: jest.fn(async () => ({
      notices: mockNotices,
      helpersToday: 214,
      you: YOU,
    })),
    report: jest.fn(async (request: NoticeRequest) => {
      const created = notice({
        id: 'novo',
        ...request,
        createdAt: NOW(),
        mine: true,
        confirmed: false,
        confirmations: 0,
        level: null,
        views: 0,
        thanks: 0,
      });
      mockNotices = [created, ...mockNotices];
      return {
        notice: created,
        merged: false,
        replaced: null,
        you: {
          ...YOU,
          points: 300,
          level: 3,
          levelAt: 300,
          nextLevelAt: 800,
          earned: 10,
        },
      };
    }),
    answer: jest.fn(async (id: string, answer) => {
      const current = mockNotices.find(item => item.id === id)!;
      const next =
        answer === 'confirm'
          ? update(id, { answer, confirmations: current.confirmations + 1 })
          : current.mine
            ? update(id, { state: 'ended' })
            : update(id, { answer, ends: current.ends + 1 });
      return { notice: next, you: { ...YOU, points: 293, earned: 3 } };
    }),
    thank: jest.fn(async (id: string) => ({
      notice: update(id, { thanked: true }),
      you: { ...YOU, earned: 0 },
    })),
    flag: jest.fn(async (_id: string) => undefined),
    seen: jest.fn(async (_ids: readonly string[]) => undefined),
    you: jest.fn(async () => ({
      you: YOU,
      counts: {
        notices: 6,
        answers: 12,
        confirmedNotices: 4,
        thanksReceived: 41,
        viewsReceived: 312,
      },
      week: { notices: 6, views: 312, thanks: 41 },
      today: [mockNotices[1]],
    })),
    community: jest.fn(async (month: string) => ({
      week: {
        from: '2026-11-23',
        notices: 1240,
        answers: 4860,
        views: 9300,
        minutesToEnd: 38,
      },
      month: {
        month,
        weekdays: 17,
        notices: 240,
        problems: [
          {
            kind: 'elevators' as const,
            status: 'long_queue' as const,
            block: null,
            gate: null,
            days: 11,
            notices: 60,
            minutesToEnd: 170,
            peakHours: [7, 13],
          },
        ],
      },
    })),
  };
  const saved = new Map<string, unknown>();
  mockServices = {
    campusNow: new CampusNow({
      server: mockServer,
      store: {
        read: async <T,>(scope: string, key: string) =>
          (saved.get(`${scope}/${key}`) as T) ?? null,
        write: async <T,>(scope: string, key: string, value: T) => {
          saved.set(`${scope}/${key}`, value);
        },
      },
      account: () => ({ scope: 'account-1' }),
      now: NOW,
    }),
    campusMap: new CampusMap(bundledCampusMap),
    notifications: {
      settings: {
        subscribe: () => () => undefined,
        getSnapshot: () => NOTIFICATIONS,
        requestPermission: jest.fn(),
        openSettings: jest.fn(),
      },
    },
  };
}

jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: () => mockServices,
  useIdentity: () => ({
    status: 'signedIn',
    account: { scope: 'account-1', name: 'MARINA', period: '2026.2' },
  }),
}));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    useNavigation: () => ({ navigate: mockNavigate, setParams: jest.fn() }),
    useRoute: () => ({ params: undefined }),
    useIsFocused: () => true,
    useFocusEffect: (effect: () => void | (() => void)) =>
      ReactModule.useEffect(effect, [effect]),
  };
});
jest.mock('@features/AttendedClassesSchedule/useNow', () => ({
  useNow: () => mockNow,
}));
jest.mock('@root/modules/academics/presentation/queries', () => ({
  useSchedule: () => mockSchedule,
}));
jest.mock('@root/modules/academics/presentation/QueryNotice', () => ({
  QueryNotice: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const renderPage = () =>
  renderWithProviders(<CampusNowPage />, {
    queryClient: createTestQueryClient(),
  });

beforeEach(() => {
  mockNow = new Date(2026, 10, 23, 14, 10);
  services();
});

it('shows the notices on the map and in the list, the one on the way first, and asks "still there?"', async () => {
  await renderPage();
  expect(
    await screen.findByText('Os elevadores ainda estão com fila grande?'),
  ).toBeOnTheScreen();
  expect(
    screen.getAllByText('Você tem aula no 6º andar do bloco B às 14:20.')
      .length,
  ).toBeGreaterThan(0);
  expect(screen.getByText('214')).toBeOnTheScreen();
  // o desenho do mapa espera a largura medida
  await fireEvent(
    screen.getByLabelText('Mapa do campus com 3 avisos'),
    'layout',
    {
      nativeEvent: { layout: { width: 320, height: 232, x: 0, y: 0 } },
    },
  );
  // um pino por aviso, com nome para o leitor de tela
  expect(
    screen.getByRole('button', {
      name: 'Banheiro sem água, F, 3º andar, novo',
    }),
  ).toBeOnTheScreen();
  // o do aluno mostra quantos viram; o novo espera confirmação
  expect(
    screen.getByText('seu aviso · 37 viram · 12 valeus'),
  ).toBeOnTheScreen();
  expect(
    screen.getByText('novo · esperando confirmação · há 4 min'),
  ).toBeOnTheScreen();
  expect(screen.getByText('Quem avisou: nível 4')).toBeOnTheScreen();
  // o que apareceu conta em "quantos viram", menos o do aluno
  await waitFor(() =>
    expect(mockServer.seen).toHaveBeenCalledWith(['lift', 'wc']),
  );
});

it('answers "still there?" right on the card and moves to the next notice', async () => {
  const success = jest.spyOn(snackbar, 'success');
  const user = userEvent.setup();
  await renderPage();
  await user.press(
    await screen.findByRole('button', {
      name: 'Continua: Os elevadores ainda estão com fila grande?',
    }),
  );
  await waitFor(() =>
    expect(mockServer.answer).toHaveBeenCalledWith('lift', 'confirm'),
  );
  await waitFor(() =>
    expect(success).toHaveBeenCalledWith(
      'Confirmado · +3 pontos',
      '8 colegas confirmaram até agora.',
    ),
  );
  expect(
    screen.queryByText('Os elevadores ainda estão com fila grande?'),
  ).toBeNull();
  // a resposta fica marcada na linha
  expect(
    screen.getByRole('togglebutton', {
      name: 'Continua: Elevadores: fila de 10 min ou mais',
    }),
  ).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ checked: true }),
  );
});

it('does not ask again after "Não vou passar por lá"', async () => {
  const user = userEvent.setup();
  await renderPage();
  await user.press(
    await screen.findByRole('button', { name: 'Não vou passar por lá' }),
  );
  await waitFor(() =>
    expect(
      screen.queryByText('Os elevadores ainda estão com fila grande?'),
    ).toBeNull(),
  );
  expect(mockServer.answer).not.toHaveBeenCalled();
});

it('reports in two taps with the place from the schedule', async () => {
  const user = userEvent.setup();
  await renderPage();
  await user.press(await screen.findByRole('button', { name: 'Avisar' }));
  expect(await screen.findByText('O que está acontecendo?')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Luz e ar' }));
  expect(await screen.findByText('Bloco B, 6º andar')).toBeOnTheScreen();
  expect(
    screen.getByText('Pela sua grade: sua aula das 14:20, na Sala 6019 B.'),
  ).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Sem ar-condicionado' }));
  await waitFor(() =>
    expect(mockServer.report).toHaveBeenCalledWith({
      kind: 'power',
      status: 'no_ac',
      place: { type: 'floor', block: 'B', floor: '6' },
    }),
  );
  expect(await screen.findByText('Valeu por avisar!')).toBeOnTheScreen();
  expect(
    screen.getByText('+10 pontos · Nível 3 · Olho no campus'),
  ).toBeOnTheScreen();
  expect(
    screen.getByText('Você subiu para o nível 3: Olho no campus!'),
  ).toBeOnTheScreen();
});

it('picks the gate when the notice is about a gate, and another floor on request', async () => {
  const user = userEvent.setup();
  await renderPage();
  await user.press(await screen.findByRole('button', { name: 'Avisar' }));
  await user.press(await screen.findByRole('button', { name: 'Acesso' }));
  await user.press(
    await screen.findByRole('button', { name: 'Portão fechado' }),
  );
  expect(await screen.findByText('Qual portão?')).toBeOnTheScreen();
  await user.press(screen.getByRole('radio', { name: /Portão 5/ }));
  await user.press(screen.getByRole('button', { name: 'Avisar aqui' }));
  await waitFor(() =>
    expect(mockServer.report).toHaveBeenCalledWith({
      kind: 'access',
      status: 'gate_closed',
      place: { type: 'gate', gate: 'portao-sfx' },
    }),
  );
  expect(await screen.findByText('Valeu por avisar!')).toBeOnTheScreen();

  await user.press(screen.getByRole('button', { name: 'Outro aviso' }));
  await user.press(await screen.findByRole('button', { name: 'Internet' }));
  await user.press(await screen.findByRole('button', { name: 'Outro lugar' }));
  await user.press(screen.getByRole('togglebutton', { name: 'Bloco A' }));
  await user.press(screen.getByRole('togglebutton', { name: '3º andar' }));
  await user.press(screen.getByRole('button', { name: 'Usar este lugar' }));
  expect(await screen.findByText('Bloco A, 3º andar')).toBeOnTheScreen();
  expect(screen.getByText('Escolhido por você.')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Wi-Fi fora' }));
  await waitFor(() =>
    expect(mockServer.report).toHaveBeenLastCalledWith({
      kind: 'internet',
      status: 'wifi_down',
      place: { type: 'floor', block: 'A', floor: '3' },
    }),
  );
});

it('marks a situation someone already reported, and the tap confirms it', async () => {
  const user = userEvent.setup();
  mockServer.report.mockImplementationOnce(async () => ({
    notice: { ...mockNotices[0], answer: 'confirm', confirmations: 8 },
    merged: true,
    replaced: null,
    you: { ...YOU, points: 293, earned: 3 },
  }));
  await renderPage();
  await user.press(await screen.findByRole('button', { name: 'Avisar' }));
  await user.press(await screen.findByRole('button', { name: 'Elevadores' }));
  await user.press(
    await screen.findByRole('button', {
      name: 'Fila de 10 min ou mais: já avisado, confirmar',
    }),
  );
  expect(await screen.findByText('Valeu por confirmar!')).toBeOnTheScreen();
  expect(
    screen.getByText(
      'Já tinham avisado isso: você confirmou o aviso, que ganha força para todo mundo.',
    ),
  ).toBeOnTheScreen();
});

it('ends the own notice, thanks and flags the others', async () => {
  const success = jest.spyOn(snackbar, 'success');
  const user = userEvent.setup();
  await renderPage();
  await user.press(await screen.findByRole('button', { name: 'Já resolveu' }));
  await waitFor(() =>
    expect(mockServer.answer).toHaveBeenCalledWith('ru', 'end'),
  );
  await waitFor(() =>
    expect(screen.queryByText('Fila pequena no bandejão')).toBeNull(),
  );
  expect(success).toHaveBeenCalledWith(
    'Aviso encerrado',
    'Saiu do mapa para todo mundo. Valeu por avisar!',
  );

  await user.press(
    screen.getByRole('togglebutton', {
      name: 'Valeu para quem avisou: Banheiro sem água',
    }),
  );
  await waitFor(() => expect(mockServer.thank).toHaveBeenCalledWith('wc'));

  await user.press(
    screen.getByRole('button', {
      name: 'Mais sobre o aviso: Banheiro sem água',
    }),
  );
  await user.press(
    await screen.findByRole('button', { name: /Não é verdade/ }),
  );
  await waitFor(() => expect(mockServer.flag).toHaveBeenCalledWith('wc'));
});

it('opens the map on the place of the notice', async () => {
  const user = userEvent.setup();
  await renderPage();
  await user.press(
    await screen.findByRole('button', {
      name: 'Mais sobre o aviso: Elevadores: fila de 10 min ou mais',
    }),
  );
  await user.press(await screen.findByRole('button', { name: 'Ver no Mapa' }));
  expect(mockNavigate).toHaveBeenCalledWith('Mapa', { place: 'bloco-c' });
});

it('says all is calm when nothing is going on, with the way to report', async () => {
  mockNotices = [];
  await renderPage();
  expect(
    await screen.findByText('Tudo tranquilo no campus agora'),
  ).toBeOnTheScreen();
  // um "Avisar" só (o do rodapé), e sem o mapa vazio
  expect(screen.getAllByRole('button', { name: 'Avisar' })).toHaveLength(1);
  expect(screen.queryByLabelText(/Mapa do campus/)).toBeNull();
});

it('explains when the student cannot be confirmed yet', async () => {
  mockServer.list.mockRejectedValue(new AppError('STUDENT_PROOF_UNAVAILABLE'));
  await renderPage();
  expect(
    await screen.findByText('Confirmando que você é aluno'),
  ).toBeOnTheScreen();
});

it('shows what the student helped with', async () => {
  const user = userEvent.setup();
  await renderPage();
  await user.press(await screen.findByRole('button', { name: /Você ajudou/ }));
  expect(await screen.findByText('Nível 2 · Na área')).toBeOnTheScreen();
  expect(
    screen.getByText('290 pontos · faltam 10 para Olho no campus'),
  ).toBeOnTheScreen();
  expect(
    screen.getByLabelText(
      '312 vezes que alguém viu um aviso seu antes de sair',
    ),
  ).toBeOnTheScreen();
  expect(
    screen.getByLabelText(/Primeiro aviso: .* Conquistada/),
  ).toBeOnTheScreen();
  expect(screen.getByLabelText(/Conferente: .* 12 de 25/)).toBeOnTheScreen();
});

it('shows the community summary and shares it as text', async () => {
  const share = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
  const user = userEvent.setup();
  await renderPage();
  await user.press(await screen.findByRole('button', { name: /Comunidade/ }));
  expect(await screen.findByText('Esta semana no campus')).toBeOnTheScreen();
  expect(screen.getByLabelText('1.240 avisos')).toBeOnTheScreen();
  expect(screen.getByText('Novembro, até hoje')).toBeOnTheScreen();
  expect(
    screen.getByLabelText(
      /Elevadores: fila de 10 min ou mais: em 11 de 17 dias úteis/,
    ),
  ).toBeOnTheScreen();
  await user.press(
    screen.getByRole('button', { name: 'Compartilhar o resumo' }),
  );
  expect(share).toHaveBeenCalledWith({
    message: expect.stringContaining('Agora no campus · Novembro, até hoje'),
  });
  // o mês anterior, para comparar
  await user.press(screen.getByRole('tab', { name: /Outubro/ }));
  await waitFor(() =>
    expect(mockServer.community).toHaveBeenLastCalledWith(
      '2026-10',
      expect.anything(),
    ),
  );
  await waitFor(() =>
    expect(screen.queryByText('Novembro, até hoje')).toBeNull(),
  );
});
